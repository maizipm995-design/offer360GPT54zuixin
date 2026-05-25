import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { Prisma, User } from '@prisma/client';
import {
  buildMemberAccessSnapshot,
  getMemberRolePermissionMaps,
  resolveMembershipState,
} from '../../common/utils/member-access';
import { PrismaService } from '../../prisma.service';
import { MembershipsService } from '../memberships/memberships.service';
import { AuthCodeBusiness } from './auth-code.constants';
import { PhoneVerificationService } from './phone-verification.service';
import { CodeLoginDto } from './dto/code-login.dto';
import { IdentifyPhoneDto } from './dto/identify-phone.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SendAuthCodeDto } from './dto/send-auth-code.dto';
import { VerifyAuthCodeDto } from './dto/verify-auth-code.dto';

type AuthUserEntity = User & {
  profile?: { name?: string | null } | null;
  membership?: {
    startAt?: Date | null;
    endAt?: Date | null;
    memberLevel?: string | null;
    standardStartAt?: Date | null;
    standardEndAt?: Date | null;
    superStartAt?: Date | null;
    superEndAt?: Date | null;
  } | null;
};

const REGISTER_GIFT_DAYS = 1;
const INVITE_REWARD_MILESTONES = [
  { milestone: 3, grantDays: 10 },
  { milestone: 5, grantDays: 15 },
  { milestone: 8, grantDays: 30 },
] as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly phoneVerificationService: PhoneVerificationService,
    private readonly membershipsService: MembershipsService,
  ) {}

  async identifyPhone(dto: IdentifyPhoneDto) {
    const phone = this.normalizePhone(dto.phone);
    const existing = await this.prisma.user.findUnique({
      where: { phone },
      select: { id: true },
    });

    return {
      phone,
      registered: Boolean(existing),
    };
  }

  async sendCode(dto: SendAuthCodeDto) {
    const phone = this.normalizePhone(dto.phone);
    await this.ensureBusinessEligibility(phone, dto.business);
    return this.phoneVerificationService.sendCode(phone, dto.business);
  }

  async verifyCode(dto: VerifyAuthCodeDto) {
    const phone = this.normalizePhone(dto.phone);
    await this.ensureBusinessEligibility(phone, dto.business);
    return this.phoneVerificationService.verifyCode(phone, dto.business, dto.code);
  }

  async login(dto: LoginDto) {
    const phone = this.normalizePhone(dto.phone);
    const user = await this.loadUserByPhone(phone);

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('手机号或密码错误');
    }

    const isValid = await bcrypt.compare(dto.password.trim(), user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('手机号或密码错误');
    }

    return this.createSession(user);
  }

  async loginWithCode(dto: CodeLoginDto) {
    const phone = this.normalizePhone(dto.phone);
    const user = await this.loadUserByPhone(phone);

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('手机号未注册或账号已停用');
    }

    await this.phoneVerificationService.verifyCode(phone, 'login', dto.code);
    const session = await this.createSession(user);
    await this.phoneVerificationService.clearCode(phone, 'login');
    return session;
  }

  async register(dto: RegisterDto) {
    const phone = this.normalizePhone(dto.phone);
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing) {
      throw new BadRequestException('手机号已注册，请直接登录');
    }

    await this.phoneVerificationService.verifyCode(phone, 'register', dto.verificationCode);

    const passwordHash = await bcrypt.hash(dto.password.trim(), 10);
    const inviter = await this.resolveInviter(dto);

    const inviteCode = await this.generateInviteCode(phone);
    const now = new Date();

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          phone,
          passwordHash,
          myInviteCode: inviteCode,
          parentUid: inviter?.id,
          needsProfileOnboarding: true,
          status: 'active',
          sourceType: inviter ? 'invite_register' : 'self_register',
          lastLoginAt: now,
        },
      });

      if (dto.name?.trim()) {
        await tx.userProfile.create({
          data: {
            userId: created.id,
            name: dto.name.trim(),
          },
        });
      }

      if (inviter) {
        await tx.invBindLog.create({
          data: {
            inviterUid: inviter.id,
            newUserUid: created.id,
            bindTime: now,
          },
        });
      }

      await tx.invRedirectLink.create({
        data: {
          randomKey: await this.generateRedirectKey(tx),
          inviterUid: created.id,
          createAt: now,
        },
      });

      await this.membershipsService.grantMembershipDaysWithTx(tx, created.id, REGISTER_GIFT_DAYS, {
        memberLevel: 'standard',
        sourceType: 'register_gift',
        sourceRemark: '新用户注册自动赠送 1 天标准会员',
      });

      if (inviter) {
        await this.grantInviteMilestoneRewards(tx, inviter.id, created.id, now);
      }

      return tx.user.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          profile: true,
          membership: true,
        },
      });
    });

    await this.phoneVerificationService.clearCode(phone, 'register');
    return this.createSession(user, false);
  }

  async resetPassword(dto: ResetPasswordDto) {
    const phone = this.normalizePhone(dto.phone);
    const user = await this.loadUserByPhone(phone);

    if (!user || user.status !== 'active') {
      throw new BadRequestException('手机号未注册或账号不可用');
    }

    await this.phoneVerificationService.verifyCode(phone, 'reset_password', dto.code);
    const passwordHash = await bcrypt.hash(dto.newPassword.trim(), 10);

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        lastLoginAt: new Date(),
      },
      include: {
        profile: true,
        membership: true,
      },
    });

    await this.phoneVerificationService.clearCode(phone, 'reset_password');
    return this.createSession(updated, false);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        membership: true,
      },
    });

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('登录状态已失效');
    }

    const now = new Date();
    const permissionMaps = await getMemberRolePermissionMaps(this.prisma);
    const access = buildMemberAccessSnapshot(user.membership, permissionMaps.effectivePermissionMap, now);

    return {
      id: user.id,
      phone: user.phone,
      inviteCode: user.myInviteCode,
      profile: user.profile,
      isMember: access.isMember,
      memberLevel: access.memberLevel,
      memberLevelLabel: access.memberLevelLabel,
      memberRoleCode: access.memberRoleCode,
      memberRoleName: access.memberRoleName,
      permissionKeys: access.permissionKeys,
      membershipRemainingDays: access.membershipRemainingDays,
      membership: this.serializeActiveMembership(user.membership, now, access),
    };
  }

  private async createSession(user: AuthUserEntity, touchLastLoginAt = true) {
    const nextUser = touchLastLoginAt
      ? await this.prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
          include: {
            profile: true,
            membership: true,
          },
        })
      : user;

    const token = await this.jwtService.signAsync({
      sub: nextUser.id,
      phone: nextUser.phone,
    });

    return {
      token,
      user: await this.toAuthUser(nextUser),
    };
  }

  private async toAuthUser(user: AuthUserEntity) {
    const permissionMaps = await getMemberRolePermissionMaps(this.prisma);
    const access = buildMemberAccessSnapshot(user.membership, permissionMaps.effectivePermissionMap);

    return {
      id: user.id,
      phone: user.phone,
      name: user.profile?.name ?? '',
      isMember: access.isMember,
      memberLevel: access.memberLevel,
      memberLevelLabel: access.memberLevelLabel,
      memberRoleCode: access.memberRoleCode,
      memberRoleName: access.memberRoleName,
      permissionKeys: access.permissionKeys,
      membershipRemainingDays: access.membershipRemainingDays,
      inviteCode: user.myInviteCode,
    };
  }

  private async grantInviteMilestoneRewards(
    tx: Prisma.TransactionClient,
    inviterUserId: string,
    triggeredByUserId: string,
    now: Date,
  ) {
    const inviteCount = await tx.user.count({ where: { parentUid: inviterUserId } });
    for (const item of INVITE_REWARD_MILESTONES) {
      if (inviteCount < item.milestone) {
        continue;
      }

      const existingReward = await tx.inviteRewardLog.findUnique({
        where: {
          inviterUid_milestone: {
            inviterUid: inviterUserId,
            milestone: item.milestone,
          },
        },
      });
      if (existingReward) {
        continue;
      }

      await this.membershipsService.grantMembershipDaysWithTx(tx, inviterUserId, item.grantDays, {
        memberLevel: 'standard',
        sourceType: 'invite_reward',
        sourceRemark: `邀请满 ${item.milestone} 人奖励 ${item.grantDays} 天标准会员`,
      });
      await tx.inviteRewardLog.create({
        data: {
          inviterUid: inviterUserId,
          milestone: item.milestone,
          grantDays: item.grantDays,
          inviteCountSnapshot: inviteCount,
          triggeredByUserId,
          rewardedAt: now,
        },
      });
    }
  }

  private serializeActiveMembership(
    membership: AuthUserEntity['membership'],
    now: Date,
    access: {
      isMember: boolean;
      memberLevel: 'standard' | 'super' | null;
      memberLevelLabel: string;
      memberRoleCode: string;
      memberRoleName: string;
      membershipRemainingDays: number;
    },
  ) {
    if (!membership || !access.isMember) {
      return null;
    }

    const resolved = resolveMembershipState(membership, now);
    if (!resolved.isMember || !resolved.activeLevel || !resolved.activeStartAt || !resolved.activeEndAt) {
      return null;
    }

    return {
      ...membership,
      memberLevel: resolved.activeLevel,
      startAt: resolved.activeStartAt,
      endAt: resolved.activeEndAt,
      memberLevelLabel: access.memberLevelLabel,
      memberRoleCode: access.memberRoleCode,
      memberRoleName: access.memberRoleName,
      remainingDays: access.membershipRemainingDays,
    };
  }

  private async ensureBusinessEligibility(phone: string, business: AuthCodeBusiness) {
    const user = await this.prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
        status: true,
      },
    });

    if (business === 'register' || business === 'update_phone') {
      if (user) {
        throw new BadRequestException(business === 'register' ? '手机号已注册，请直接登录' : '该手机号已被其他账号使用，请更换后重试');
      }
      return;
    }

    if (!user) {
      throw new BadRequestException(business === 'login' ? '手机号未注册，请先完成注册' : '手机号未注册，无法重置密码');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('账号已停用，请联系客服处理');
    }
  }

  private async loadUserByPhone(phone: string) {
    return this.prisma.user.findUnique({
      where: { phone },
      include: {
        profile: true,
        membership: true,
      },
    });
  }

  private normalizePhone(phone: string) {
    return phone.trim();
  }

  private async generateInviteCode(phone: string) {
    const suffix = phone.slice(-4);
    for (let index = 0; index < 10; index += 1) {
      const candidate = `OF${suffix}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const existing = await this.prisma.user.findUnique({ where: { myInviteCode: candidate } });
      if (!existing) {
        return candidate;
      }
    }
    return `OF${Date.now().toString(36).toUpperCase()}`;
  }

  private async generateRedirectKey(tx: Prisma.TransactionClient) {
    for (let index = 0; index < 10; index += 1) {
      const candidate = `INV${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
      const existing = await tx.invRedirectLink.findUnique({ where: { randomKey: candidate } });
      if (!existing) {
        return candidate;
      }
    }
    return `INV${Date.now().toString(36).toUpperCase()}`;
  }

  private async resolveInviter(dto: RegisterDto) {
    const inviteTokenInput = dto.inviteToken?.trim().toUpperCase();
    if (inviteTokenInput) {
      const redirectLink = await this.prisma.invRedirectLink.findUnique({
        where: { randomKey: inviteTokenInput },
        select: {
          inviterUid: true,
          expireAt: true,
        },
      });

      if (redirectLink && (!redirectLink.expireAt || redirectLink.expireAt > new Date())) {
        const inviter = await this.prisma.user.findUnique({
          where: { id: redirectLink.inviterUid },
        });
        if (inviter) {
          return inviter;
        }
      }
    }

    const inviteCodeInput = dto.inviteCode?.trim().toUpperCase();
    if (!inviteCodeInput) {
      return null;
    }

    return this.prisma.user.findUnique({
      where: { myInviteCode: inviteCodeInput },
    });
  }
}
