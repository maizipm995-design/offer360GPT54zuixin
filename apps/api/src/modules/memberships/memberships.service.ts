import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  buildMemberAccessSnapshot,
  getMemberLevelLabel,
  getMemberRolePermissionMaps,
  normalizeStoredMemberLevel,
  parseMemberLevelInput,
  resolveMembershipState,
  type MemberLevel,
} from '../../common/utils/member-access';
import { getMembershipRemainingDays, isMembershipActive, MEMBERSHIP_DAY_IN_MS } from '../../common/utils/membership-time';
import { PrismaService } from '../../prisma.service';
import { invalidateJobsRecommendationCacheByUserId } from '../jobs/jobs-recommendation-cache';
import { StorageService } from '../storage/storage.service';
import { getHtmlContentLocationDefinition } from './html-content-locations';

const SUPER_MEMBER_INTERVIEW_TRANSCRIPT_COUNT = 20;

@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async getCurrent(userId: string) {
    const [membership, permissionMaps] = await Promise.all([
      this.prisma.userMembership.findUnique({ where: { userId } }),
      getMemberRolePermissionMaps(this.prisma),
    ]);
    const now = new Date();
    const access = buildMemberAccessSnapshot(membership, permissionMaps.effectivePermissionMap, now);
    const currentMembership = this.buildCurrentMembershipPayload(membership, now);

    return {
      ...access,
      membership: currentMembership
        ? {
            ...currentMembership,
            memberLevelLabel: access.memberLevelLabel,
            memberRoleCode: access.memberRoleCode,
            memberRoleName: access.memberRoleName,
            remainingDays: access.membershipRemainingDays,
          }
        : null,
    };
  }

  async getPlans() {
    const plans = await this.prisma.serviceProduct.findMany({
      where: {
        status: true,
        productType: 'membership',
      },
      orderBy: [{ isHot: 'desc' }, { price: 'asc' }],
    });

    return plans.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: Number(item.price),
      originalPrice: Number(item.originalPrice),
      score: Number(item.score),
      salesCount: item.salesCount,
      isHot: item.isHot,
      grantDays: item.grantDays ?? 0,
      memberLevel: normalizeStoredMemberLevel(item.memberLevel) ?? 'standard',
      memberLevelLabel: getMemberLevelLabel(item.memberLevel),
    }));
  }

  async openMembership(userId: string, body?: { days?: number; memberLevel?: unknown }) {
    const days = Number(body?.days ?? 180);
    if (!Number.isFinite(days) || days <= 0) {
      throw new BadRequestException('开通天数必须大于 0');
    }
    const memberLevel = parseMemberLevelInput(body?.memberLevel, 'standard');

    const membership = await this.grantMembershipDaysWithTx(this.prisma, userId, days, {
      memberLevel,
      sourceType: 'manual',
      sourceRemark: `前台开通 ${getMemberLevelLabel(memberLevel)} ${days} 天`,
    });

    const now = new Date();
    const permissionMaps = await getMemberRolePermissionMaps(this.prisma);
    const access = buildMemberAccessSnapshot(membership, permissionMaps.effectivePermissionMap, now);
    const resolved = resolveMembershipState(membership, now);
    invalidateJobsRecommendationCacheByUserId(userId);

    return {
      endAt: resolved.activeEndAt,
      remainingDays: access.membershipRemainingDays,
      isMember: access.isMember,
      memberLevel: resolved.activeLevel ?? memberLevel,
      memberLevelLabel: access.memberLevelLabel,
      memberRoleCode: access.memberRoleCode,
      memberRoleName: access.memberRoleName,
      permissionKeys: access.permissionKeys,
    };
  }

  async redeemMembership(userId: string, code: string) {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      throw new BadRequestException('请输入兑换码');
    }

    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const redeemCode = await tx.membershipRedeemCode.findUnique({
        where: { code: normalizedCode },
        include: { batch: true },
      });

      if (!redeemCode) {
        throw new NotFoundException('兑换码不存在');
      }
      if (redeemCode.batch.status !== 'active') {
        throw new BadRequestException('当前兑换码批次未启用');
      }
      if (redeemCode.status === 'used') {
        throw new BadRequestException('该兑换码已使用');
      }
      if (redeemCode.status === 'void') {
        throw new BadRequestException('该兑换码已作废');
      }
      if (redeemCode.status === 'expired') {
        throw new BadRequestException('该兑换码已过期');
      }
      if (redeemCode.batch.validFrom && redeemCode.batch.validFrom > now) {
        throw new BadRequestException('该兑换码尚未到生效时间');
      }

      const expiresAt = redeemCode.validUntil ?? redeemCode.batch.validUntil;
      if (expiresAt && expiresAt <= now) {
        await tx.membershipRedeemCode.update({
          where: { id: redeemCode.id },
          data: { status: 'expired' },
        });
        throw new BadRequestException('该兑换码已过期');
      }

      const memberLevel = normalizeStoredMemberLevel(redeemCode.batch.memberLevel) ?? 'standard';
      const membership = await this.grantMembershipDaysWithTx(tx, userId, redeemCode.batch.grantDays, {
        memberLevel,
        sourceType: 'redeem_code',
        sourceRemark: `兑换码 ${normalizedCode}`,
      });

      await tx.membershipRedeemCode.update({
        where: { id: redeemCode.id },
        data: {
          status: 'used',
          usedByUserId: userId,
          usedAt: now,
        },
      });

      await tx.membershipRedeemCodeBatch.update({
        where: { id: redeemCode.batchId },
        data: {
          usedCount: { increment: 1 },
        },
      });

      await tx.membershipRedeemUseLog.create({
        data: {
          batchId: redeemCode.batchId,
          codeId: redeemCode.id,
          userId,
          membershipId: membership.id,
          grantDays: redeemCode.batch.grantDays,
          usedAt: now,
          remark: `用户兑换 ${getMemberLevelLabel(memberLevel)} · ${redeemCode.batch.cardType}`,
        },
      });

      const permissionMaps = await getMemberRolePermissionMaps(tx);
      const access = buildMemberAccessSnapshot(membership, permissionMaps.effectivePermissionMap, now);
      const resolved = resolveMembershipState(membership, now);

      return {
        code: normalizedCode,
        cardType: redeemCode.batch.cardType,
        grantDays: redeemCode.batch.grantDays,
        endAt: resolved.activeEndAt,
        remainingDays: access.membershipRemainingDays,
        isMember: access.isMember,
        memberLevel: resolved.activeLevel ?? memberLevel,
        memberLevelLabel: access.memberLevelLabel,
        memberRoleCode: access.memberRoleCode,
        memberRoleName: access.memberRoleName,
        permissionKeys: access.permissionKeys,
      };
    }).then((result) => {
      invalidateJobsRecommendationCacheByUserId(userId);
      return result;
    });
  }

  async getBenefitsContent() {
    const location = getHtmlContentLocationDefinition('membership-benefits');
    return this.hydrateRichTextContent(await this.ensurePublishedRichTextContent({
      slug: location.slug,
      title: location.title,
      htmlContent: location.defaultHtml,
    }));
  }

  async getCareerJourneyContent() {
    const location = getHtmlContentLocationDefinition('career-journey');
    return this.hydrateRichTextContent(await this.ensurePublishedRichTextContent({
      slug: location.slug,
      title: location.title,
      htmlContent: location.defaultHtml,
    }));
  }

  private async ensurePublishedRichTextContent(options: {
    slug: string;
    title: string;
    htmlContent: string;
  }) {
    const existing = await this.prisma.membershipRichTextContent.findFirst({
      where: {
        slug: options.slug,
        status: 'published',
      },
      orderBy: [{ version: 'desc' }, { updatedAt: 'desc' }],
    });

    if (existing) {
      return existing;
    }

    return this.prisma.membershipRichTextContent.create({
      data: {
        slug: options.slug,
        title: options.title,
        htmlContent: options.htmlContent,
        status: 'published',
        version: 1,
        publishedAt: new Date(),
      },
    });
  }

  private async hydrateRichTextContent<T extends { htmlContent: string }>(item: T) {
    const htmlPayload = await this.storageService.buildHtmlPreviewPayload(item.htmlContent);
    return {
      ...item,
      htmlContent: htmlPayload.previewHtml,
    };
  }

  async grantMembershipFromOrder(
    tx: Prisma.TransactionClient | PrismaService,
    userId: string,
    options: {
      memberLevel: MemberLevel;
      grantDays: number;
      orderNo: string;
    },
  ) {
    if (!Number.isFinite(options.grantDays) || options.grantDays <= 0) {
      throw new BadRequestException('会员订单缺少有效会员时长');
    }

    const membership = await this.grantMembershipDaysWithTx(tx, userId, options.grantDays, {
      memberLevel: options.memberLevel,
      sourceType: 'payment',
      sourceRemark: `微信支付订单 ${options.orderNo}`,
    });
    invalidateJobsRecommendationCacheByUserId(userId);
    return membership;
  }

  async grantMembershipDaysWithTx(
    tx: Prisma.TransactionClient | PrismaService,
    userId: string,
    days: number,
    options?: {
      sourceType?: string;
      sourceRemark?: string;
      memberLevel?: MemberLevel;
      allowDowngrade?: boolean;
      openedByAdminId?: string | null;
    },
  ) {
    const current = await tx.userMembership.findUnique({ where: { userId } });
    const now = new Date();
    const requestedMemberLevel = options?.memberLevel ?? normalizeStoredMemberLevel(current?.memberLevel) ?? 'standard';
    const activeSuperEndAt = current?.superEndAt && isMembershipActive(current.superEndAt, now) ? current.superEndAt : null;
    const nextStandard = this.extendMembershipWindow({
      now,
      currentStartAt: current?.standardStartAt ?? null,
      currentEndAt: current?.standardEndAt ?? null,
      delayUntil: requestedMemberLevel === 'standard' ? activeSuperEndAt : null,
      grantDays: requestedMemberLevel === 'standard' ? days : 0,
    });
    const nextSuper = this.extendMembershipWindow({
      now,
      currentStartAt: current?.superStartAt ?? null,
      currentEndAt: current?.superEndAt ?? null,
      delayUntil: null,
      grantDays: requestedMemberLevel === 'super' ? days : 0,
    });
    const draftMembership = {
      startAt: current?.startAt ?? now,
      endAt: current?.endAt ?? now,
      memberLevel: current?.memberLevel ?? requestedMemberLevel,
      standardStartAt: nextStandard.startAt,
      standardEndAt: nextStandard.endAt,
      superStartAt: nextSuper.startAt,
      superEndAt: nextSuper.endAt,
    };
    const resolved = resolveMembershipState(draftMembership, now);
    const fallbackLevel = requestedMemberLevel === 'super'
      ? (nextSuper.endAt ? 'super' : resolved.activeLevel ?? 'standard')
      : (resolved.activeLevel ?? 'standard');
    const legacyStartAt = resolved.activeStartAt ?? draftMembership.standardStartAt ?? draftMembership.superStartAt ?? now;
    const legacyEndAt = resolved.activeEndAt ?? draftMembership.standardEndAt ?? draftMembership.superEndAt ?? now;
    const remainingDays = getMembershipRemainingDays(legacyEndAt, now);

    const membership = await tx.userMembership.upsert({
      where: { userId },
      update: {
        memberLevel: fallbackLevel,
        startAt: legacyStartAt,
        endAt: legacyEndAt,
        standardStartAt: nextStandard.startAt,
        standardEndAt: nextStandard.endAt,
        superStartAt: nextSuper.startAt,
        superEndAt: nextSuper.endAt,
        remainingDays,
        sourceType: options?.sourceType ?? current?.sourceType ?? 'manual',
        sourceRemark: options?.sourceRemark,
        openedByAdminId: options?.openedByAdminId ?? current?.openedByAdminId ?? null,
      },
      create: {
        userId,
        memberLevel: fallbackLevel,
        startAt: legacyStartAt,
        endAt: legacyEndAt,
        standardStartAt: nextStandard.startAt,
        standardEndAt: nextStandard.endAt,
        superStartAt: nextSuper.startAt,
        superEndAt: nextSuper.endAt,
        remainingDays,
        sourceType: options?.sourceType ?? 'manual',
        sourceRemark: options?.sourceRemark,
        openedByAdminId: options?.openedByAdminId ?? null,
      },
    });

    if (requestedMemberLevel === 'super') {
      await tx.$executeRaw`
        UPDATE users
        SET interview_transcript_super_count = interview_transcript_super_count + ${SUPER_MEMBER_INTERVIEW_TRANSCRIPT_COUNT}
        WHERE id = ${userId}
      `;
    }

    return membership;
  }

  private extendMembershipWindow(options: {
    now: Date;
    currentStartAt?: Date | null;
    currentEndAt?: Date | null;
    delayUntil?: Date | null;
    grantDays: number;
  }) {
    if (options.grantDays <= 0) {
      return {
        startAt: options.currentStartAt ?? null,
        endAt: options.currentEndAt ?? null,
      };
    }

    const baseStartAt = options.delayUntil && options.delayUntil.getTime() > options.now.getTime()
      ? options.delayUntil
      : options.now;
    const hasExistingFutureWindow = Boolean(options.currentEndAt && options.currentEndAt.getTime() > baseStartAt.getTime());
    const startAt = hasExistingFutureWindow
      ? options.currentStartAt ?? baseStartAt
      : baseStartAt;
    const endBase = hasExistingFutureWindow
      ? options.currentEndAt!
      : baseStartAt;
    const endAt = new Date(endBase.getTime() + options.grantDays * MEMBERSHIP_DAY_IN_MS);

    return { startAt, endAt };
  }

  private buildCurrentMembershipPayload(
    membership: {
      id: string;
      memberLevel?: string | null;
      standardStartAt?: Date | null;
      standardEndAt?: Date | null;
      superStartAt?: Date | null;
      superEndAt?: Date | null;
    } | null,
    now: Date,
  ) {
    if (!membership) {
      return null;
    }

    const resolved = resolveMembershipState(membership, now);
    if (!resolved.isMember || !resolved.activeLevel || !resolved.activeStartAt || !resolved.activeEndAt) {
      return null;
    }

    return {
      id: membership.id,
      memberLevel: resolved.activeLevel,
      startAt: resolved.activeStartAt,
      endAt: resolved.activeEndAt,
      standardStartAt: resolved.standardStartAt,
      standardEndAt: resolved.standardEndAt,
      superStartAt: resolved.superStartAt,
      superEndAt: resolved.superEndAt,
    };
  }
}
