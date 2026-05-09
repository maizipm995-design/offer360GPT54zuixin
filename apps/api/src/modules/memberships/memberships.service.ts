import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  buildMemberAccessSnapshot,
  getMemberLevelLabel,
  getMemberRolePermissionMaps,
  normalizeStoredMemberLevel,
  parseMemberLevelInput,
  type MemberLevel,
} from '../../common/utils/member-access';
import { getMembershipRemainingDays, isMembershipActive, MEMBERSHIP_DAY_IN_MS } from '../../common/utils/membership-time';
import { PrismaService } from '../../prisma.service';
import { invalidateJobsRecommendationCacheByUserId } from '../jobs/jobs-recommendation-cache';
import { StorageService } from '../storage/storage.service';
import {
  MEMBERSHIP_BENEFITS_CONTENT_HTML,
  MEMBERSHIP_BENEFITS_CONTENT_SLUG,
  MEMBERSHIP_BENEFITS_CONTENT_TITLE,
} from './membership-benefits-content';
import {
  CAREER_JOURNEY_CONTENT_HTML,
  CAREER_JOURNEY_CONTENT_SLUG,
  CAREER_JOURNEY_CONTENT_TITLE,
} from './career-journey-content';

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

    return {
      ...access,
      membership: access.isMember && membership
        ? {
            ...membership,
            memberLevel: normalizeStoredMemberLevel(membership.memberLevel) ?? 'standard',
            memberLevelLabel: getMemberLevelLabel(membership.memberLevel),
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

    const membership = await this.applyMembershipWithTx(this.prisma, userId, days, {
      memberLevel,
      sourceType: 'manual',
      sourceRemark: `前台开通 ${getMemberLevelLabel(memberLevel)} ${days} 天`,
    });

    const permissionMaps = await getMemberRolePermissionMaps(this.prisma);
    const access = buildMemberAccessSnapshot(membership, permissionMaps.effectivePermissionMap);
    invalidateJobsRecommendationCacheByUserId(userId);

    return {
      endAt: membership.endAt,
      remainingDays: access.membershipRemainingDays,
      isMember: access.isMember,
      memberLevel,
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
      const membership = await this.applyMembershipWithTx(tx, userId, redeemCode.batch.grantDays, {
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

      return {
        code: normalizedCode,
        cardType: redeemCode.batch.cardType,
        grantDays: redeemCode.batch.grantDays,
        endAt: membership.endAt,
        remainingDays: access.membershipRemainingDays,
        isMember: access.isMember,
        memberLevel,
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
    return this.hydrateRichTextContent(await this.ensurePublishedRichTextContent({
      slug: MEMBERSHIP_BENEFITS_CONTENT_SLUG,
      title: MEMBERSHIP_BENEFITS_CONTENT_TITLE,
      htmlContent: MEMBERSHIP_BENEFITS_CONTENT_HTML,
    }));
  }

  async getCareerJourneyContent() {
    return this.hydrateRichTextContent(await this.ensurePublishedRichTextContent({
      slug: CAREER_JOURNEY_CONTENT_SLUG,
      title: CAREER_JOURNEY_CONTENT_TITLE,
      htmlContent: CAREER_JOURNEY_CONTENT_HTML,
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

    const membership = await this.applyMembershipWithTx(tx, userId, options.grantDays, {
      memberLevel: options.memberLevel,
      sourceType: 'payment',
      sourceRemark: `微信支付订单 ${options.orderNo}`,
    });
    invalidateJobsRecommendationCacheByUserId(userId);
    return membership;
  }

  private async applyMembershipWithTx(
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
    const currentActive = current ? isMembershipActive(current.endAt, now) : false;
    const startAt = current && currentActive ? current.startAt : now;
    const endBase = current && currentActive ? current.endAt : now;
    const endAt = new Date(endBase.getTime() + days * MEMBERSHIP_DAY_IN_MS);
    const remainingDays = getMembershipRemainingDays(endAt, now);
    const currentMemberLevel = normalizeStoredMemberLevel(current?.memberLevel);
    const requestedMemberLevel = options?.memberLevel ?? currentMemberLevel ?? 'standard';
    const nextMemberLevel = currentActive && currentMemberLevel === 'super' && requestedMemberLevel === 'standard' && !options?.allowDowngrade
      ? 'super'
      : requestedMemberLevel;

    return tx.userMembership.upsert({
      where: { userId },
      update: {
        memberLevel: nextMemberLevel,
        startAt,
        endAt,
        remainingDays,
        sourceType: options?.sourceType ?? current?.sourceType ?? 'manual',
        sourceRemark: options?.sourceRemark,
        openedByAdminId: options?.openedByAdminId ?? current?.openedByAdminId ?? null,
      },
      create: {
        userId,
        memberLevel: nextMemberLevel,
        startAt,
        endAt,
        remainingDays,
        sourceType: options?.sourceType ?? 'manual',
        sourceRemark: options?.sourceRemark,
        openedByAdminId: options?.openedByAdminId ?? null,
      },
    });
  }
}
