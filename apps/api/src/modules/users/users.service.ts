import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import {
  buildMemberAccessSnapshot,
  getMemberRolePermissionMaps,
  normalizeStoredMemberLevel,
} from '../../common/utils/member-access';
import { isMembershipActive } from '../../common/utils/membership-time';
import { PrismaService } from '../../prisma.service';
import { PhoneVerificationService } from '../auth/phone-verification.service';
import { JobsNormalizationService } from '../jobs/jobs-normalization.service';
import { invalidateJobsRecommendationCacheByUserId } from '../jobs/jobs-recommendation-cache';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdatePhoneDto } from './dto/update-phone.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly normalizationService: JobsNormalizationService,
    private readonly phoneVerificationService: PhoneVerificationService,
  ) {}

  async getOverview(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        preference: true,
        membership: true,
        wallet: true,
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const now = new Date();
    const preference = user.preference
      ? {
          intentionCity: Array.isArray(user.preference.intentionCity) ? user.preference.intentionCity as string[] : [],
          intentionJob: Array.isArray(user.preference.intentionJob) ? user.preference.intentionJob as string[] : [],
          intentionCompany: Array.isArray(user.preference.intentionCompany) ? user.preference.intentionCompany as string[] : [],
        }
      : null;
    const [permissionMaps, normalizedPreference, normalizedProfile] = await Promise.all([
      getMemberRolePermissionMaps(this.prisma),
      preference ? this.buildNormalizedPreferencePayload(preference) : Promise.resolve(null),
      user.profile
        ? Promise.all([
            this.normalizationService.normalizeOptionalValueForStorage('DEGREE', user.profile.degree),
            this.normalizationService.normalizeOptionalValueForStorage('MAJOR', user.profile.major),
          ]).then(([degree, major]) => ({ degree, major }))
        : Promise.resolve(null),
    ]);
    const access = buildMemberAccessSnapshot(user.membership, permissionMaps.effectivePermissionMap, now);

    return {
      id: user.id,
      phone: user.phone,
      inviteCode: user.myInviteCode,
      profile: user.profile,
      normalizedProfile,
      preference,
      normalizedPreference,
      isMember: access.isMember,
      memberLevel: access.memberLevel,
      memberLevelLabel: access.memberLevelLabel,
      memberRoleCode: access.memberRoleCode,
      memberRoleName: access.memberRoleName,
      permissionKeys: access.permissionKeys,
      membershipRemainingDays: access.membershipRemainingDays,
      membership: user.membership && isMembershipActive(user.membership.endAt, now)
        ? {
            id: user.membership.id,
            memberLevel: normalizeStoredMemberLevel(user.membership.memberLevel) ?? 'standard',
            memberLevelLabel: access.memberLevelLabel,
            memberRoleCode: access.memberRoleCode,
            memberRoleName: access.memberRoleName,
            startAt: user.membership.startAt,
            endAt: user.membership.endAt,
            remainingDays: access.membershipRemainingDays,
          }
        : null,
      wallet: user.wallet
        ? {
            availableBalance: Number(user.wallet.availableBalance),
            frozenBalance: Number(user.wallet.frozenBalance),
            totalEarn: Number(user.wallet.totalEarn),
          }
        : null,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const [degree, major] = await Promise.all([
      this.normalizationService.normalizeOptionalValueForStorage('DEGREE', dto.degree),
      this.normalizationService.normalizeOptionalValueForStorage('MAJOR', dto.major),
    ]);

    const payload = {
      ...dto,
      ...(degree !== undefined ? { degree } : {}),
      ...(major !== undefined ? { major } : {}),
    };

    const result = await this.prisma.userProfile.upsert({
      where: { userId },
      update: payload,
      create: {
        userId,
        ...payload,
      },
    });
    invalidateJobsRecommendationCacheByUserId(userId);
    return result;
  }

  async getPreferences(userId: string) {
    const preference = await this.prisma.userJobPreferenceTag.findUnique({ where: { userId } });
    const serialized = this.serializePreferences(
      preference ?? {
        userId,
        intentionCity: [],
        intentionJob: [],
        intentionCompany: [],
      },
    );

    return {
      ...serialized,
      normalizedPreference: await this.buildNormalizedPreferencePayload(serialized),
    };
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    const [intentionCity, intentionJob, intentionCompany] = await Promise.all([
      this.normalizationService.normalizePreferencesForStorage('LOCATION', this.sanitizePreferenceValues(dto.intentionCity ?? [])),
      this.normalizationService.normalizePreferencesForStorage('JOB_TITLE', this.sanitizePreferenceValues(dto.intentionJob ?? [])),
      this.normalizationService.normalizePreferencesForStorage('COMPANY', this.sanitizePreferenceValues(dto.intentionCompany ?? [])),
    ]);

    const result = await this.prisma.userJobPreferenceTag.upsert({
      where: { userId },
      update: {
        intentionCity: intentionCity ?? [],
        intentionJob: intentionJob ?? [],
        intentionCompany: intentionCompany ?? [],
      },
      create: {
        userId,
        intentionCity: intentionCity ?? [],
        intentionJob: intentionJob ?? [],
        intentionCompany: intentionCompany ?? [],
      },
    });
    invalidateJobsRecommendationCacheByUserId(userId);

    const serialized = this.serializePreferences(result);
    return {
      ...serialized,
      normalizedPreference: await this.buildNormalizedPreferencePayload(serialized),
    };
  }

  private serializePreferences(
    preference:
      | {
          id?: bigint;
          userId: string;
          intentionCity: unknown;
          intentionJob: unknown;
          intentionCompany: unknown;
          createTime?: Date;
          updateTime?: Date;
        }
      | null,
  ) {
    return {
      id: typeof preference?.id === 'bigint' ? preference.id.toString() : undefined,
      userId: preference?.userId ?? '',
      intentionCity: Array.isArray(preference?.intentionCity) ? preference.intentionCity as string[] : [],
      intentionJob: Array.isArray(preference?.intentionJob) ? preference.intentionJob as string[] : [],
      intentionCompany: Array.isArray(preference?.intentionCompany) ? preference.intentionCompany as string[] : [],
      createTime: preference?.createTime,
      updateTime: preference?.updateTime,
    };
  }

  private async buildNormalizedPreferencePayload(preference: {
    intentionCity: string[];
    intentionJob: string[];
    intentionCompany: string[];
  }) {
    const [intentionCity, intentionJob, intentionCompany] = await Promise.all([
      this.normalizationService.normalizePreferencesForStorage('LOCATION', preference.intentionCity),
      this.normalizationService.normalizePreferencesForStorage('JOB_TITLE', preference.intentionJob),
      this.normalizationService.normalizePreferencesForStorage('COMPANY', preference.intentionCompany),
    ]);

    return {
      intentionCity: intentionCity ?? [],
      intentionJob: intentionJob ?? [],
      intentionCompany: intentionCompany ?? [],
    };
  }

  private sanitizePreferenceValues(values: string[]) {
    return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
  }

  async updatePhone(userId: string, dto: UpdatePhoneDto) {
    const nextPhone = dto.phone.trim();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    if (user.phone === nextPhone) {
      throw new BadRequestException('新手机号不能与当前手机号相同');
    }

    const existing = await this.prisma.user.findUnique({ where: { phone: nextPhone } });
    if (existing && existing.id !== userId) {
      throw new BadRequestException('手机号已被占用');
    }

    await this.phoneVerificationService.verifyCode(nextPhone, 'update_phone', dto.code);
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { phone: nextPhone },
      select: { id: true, phone: true },
    });
    await this.phoneVerificationService.clearCode(nextPhone, 'update_phone');

    return updatedUser;
  }

  async updatePassword(userId: string, dto: UpdatePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true },
    });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const currentPhone = user.phone.trim();
    if (dto.phone.trim() !== currentPhone) {
      throw new BadRequestException('当前手机号已更新，请刷新页面后重试');
    }

    await this.phoneVerificationService.verifyCode(currentPhone, 'reset_password', dto.code);

    const passwordHash = await bcrypt.hash(dto.newPassword.trim(), 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    await this.phoneVerificationService.clearCode(currentPhone, 'reset_password');

    return { updated: true };
  }
}
