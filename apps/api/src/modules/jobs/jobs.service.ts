import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { JobAnnouncement, Prisma } from '@prisma/client';
import { RedisService } from '../../common/redis/redis.service';
import {
  assertUserHasMemberPermission,
  getUserMemberAccess,
  type MemberAccessSnapshot,
} from '../../common/utils/member-access';
import {
  getJobsRiskConfig,
  type JobsAccessLimitActionConfig,
  type JobsRiskConfig,
} from '../../common/utils/jobs-risk-config';
import { PrismaService } from '../../prisma.service';
import { JobsClickDto } from './dto/jobs-click.dto';
import { QueryJobsDto } from './dto/query-jobs.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';
import {
  buildLegacyJobCard,
  resolveJobDeliveryMethod,
  resolveValidAnnouncementUrl,
  resolveValidDeliveryTarget,
  type JobAnnouncementViewPayload,
} from './job-announcement-view';
import { invalidateJobsRecommendationCacheByUserId } from './jobs-recommendation-cache';
import { JobsMetricsService } from './jobs-metrics.service';
import { JobsRecommendationService } from './jobs-recommendation.service';
import { JobsNormalizationService } from './jobs-normalization.service';
import type { JobsNormalizationDomain } from './jobs-normalization.types';
import { buildLocationRecallClauses } from './jobs-recommendation-location';
import { subDays } from './jobs.utils';

const GENERAL_SEARCH_FIELDS = [
  'companyFullName',
  'enterpriseNature',
  'degreeRequirement',
  'workLocation',
  'jobName',
  'majorRequirement',
  'recruitmentType',
  'deadlineAt',
  'graduationSession',
  'referralCode',
  'announcementTitle',
  'industry',
  'entryDate',
  'status',
] as const;

const JOB_RISK_FREEZE_REGISTRY_KEY = 'jobs:freeze:registry';
const JOB_RISK_CONTROL_REGISTRY_KEY = 'jobs:risk:control:registry';
const FREE_ZONE_CANDIDATE_FETCH_LIMIT = 120;

type GeneralSearchField = (typeof GENERAL_SEARCH_FIELDS)[number];
type JobsAccessAction = 'detail' | 'view_announcement' | 'deliver';
type JobFreezeScope = 'user' | 'ip' | 'device';
type JobAccessLimitScope = JobFreezeScope | 'session';
type JobRiskLevel = 1 | 2 | 3 | 4;
type JobRiskControlType = 'cooldown' | 'restrict' | 'freeze';
type JobAccessRequestContext = {
  ip?: string | null;
  userAgent?: string | null;
  deviceId?: string | null;
  sessionId?: string | null;
  requestPath?: string | null;
  requestRoute?: 'list' | 'detail' | 'view_announcement' | 'deliver' | 'announcement_redirect' | 'delivery_redirect';
  page?: number | null;
  limit?: number | null;
  filterFingerprint?: string | null;
};
type JobAccessLimitSubject = {
  scope: JobAccessLimitScope;
  identifier: string;
};
type JobRiskSubject = {
  scope: JobAccessLimitScope;
  identifier: string;
};
type JobActionAccessOptions = {
  bypassPermission?: boolean;
};
type ControlledJobAccessTokenPayload = {
  sub?: string;
  jobId?: string;
  purpose?: 'jobs:view-announcement' | 'jobs:deliver';
  tokenId?: string;
  deviceIdHash?: string;
  sessionIdHash?: string;
};
type JobFreezePayload = {
  reason: string;
  createdAt: string;
  source: 'automatic' | 'manual';
  ruleKey?: string | null;
  evidence?: string | null;
  level?: JobRiskLevel | null;
  controlType?: JobRiskControlType | null;
};
type JobRiskDecision = {
  level: JobRiskLevel;
  controlType: JobRiskControlType;
  responseStatus: HttpStatus;
  reason: string;
  durationSeconds: number;
  ruleKey: string;
  evidence?: string | null;
};
type JobAccessAuditDraft = {
  jobId: string;
  userId?: string | null;
  membershipId?: string | null;
  memberLevel?: string | null;
  action: JobsAccessAction;
  requestStatus: 'issued' | 'consumed' | 'denied' | 'expired';
  accessTokenId?: string | null;
  redirectTargetType?: string | null;
  limitHit?: boolean;
  riskHit?: boolean;
  failureReason?: string | null;
  expiresAt?: Date | null;
  consumedAt?: Date | null;
  context?: JobAccessRequestContext;
};
type JobAccessLogDelegate = {
  create: (args: {
    data: {
      jobId: string;
      userId: string | null;
      membershipId: string | null;
      memberLevel: string | null;
      action: string;
      requestStatus: string;
      accessTokenId: string | null;
      redirectTargetType: string | null;
      limitHit: boolean;
      riskHit: boolean;
      failureReason: string | null;
      consumedAt: Date | null;
      expiresAt: Date | null;
      ip: string | null;
      userAgent: string | null;
      deviceId: string | null;
      sessionId: string | null;
      reviewStatus: string;
    };
  }) => Promise<unknown>;
  findUnique: (args: { where: { accessTokenId: string } }) => Promise<{
    jobId: string;
    userId: string | null;
    accessTokenId: string | null;
    requestStatus: string;
    consumedAt: Date | null;
    expiresAt: Date | null;
  } | null>;
  update: (args: {
    where: { accessTokenId: string };
    data: Record<string, unknown>;
  }) => Promise<unknown>;
};

const FIXED_DEGREE_OPTIONS = ['专科', '本科', '硕士', '博士'] as const;
const FIXED_ENTERPRISE_NATURE_OPTIONS = [
  '央企',
  '国企',
  '银行',
  '内资',
  '外资',
  '民营',
  '民企',
  '股份',
  '混合',
  '合资',
  '上市企业',
  '社会组织',
  '事业单位',
  '外企',
  '政府单位',
  '其他',
] as const;
const FIXED_RECRUITMENT_TYPE_OPTIONS = ['全职', '秋招', '春招', '校招', '实习'] as const;

const DEGREE_FILTER_ALIASES: Record<(typeof FIXED_DEGREE_OPTIONS)[number], string[]> = {
  专科: ['专科', '大专'],
  本科: ['本科'],
  硕士: ['硕士'],
  博士: ['博士'],
};

const ENTERPRISE_NATURE_FILTER_ALIASES: Record<Exclude<(typeof FIXED_ENTERPRISE_NATURE_OPTIONS)[number], '其他'>, string[]> = {
  央企: ['央企'],
  国企: ['国企', '国有企业'],
  银行: ['银行'],
  内资: ['内资'],
  外资: ['外资'],
  民营: ['民营'],
  民企: ['民企'],
  股份: ['股份'],
  混合: ['混合'],
  合资: ['合资'],
  上市企业: ['上市企业', '上市公司'],
  社会组织: ['社会组织'],
  事业单位: ['事业单位'],
  外企: ['外企'],
  政府单位: ['政府单位', '政府机关'],
};

const ENTERPRISE_NATURE_KNOWN_KEYWORDS = Array.from(new Set(Object.values(ENTERPRISE_NATURE_FILTER_ALIASES).flat()));

const RECRUITMENT_TYPE_FILTER_ALIASES: Record<(typeof FIXED_RECRUITMENT_TYPE_OPTIONS)[number], string[]> = {
  全职: ['全职'],
  秋招: ['秋招', '秋季'],
  春招: ['春招', '春季'],
  校招: ['校招', '校园招聘'],
  实习: ['实习'],
};

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly jobsRecommendationService: JobsRecommendationService,
    private readonly jobsMetricsService: JobsMetricsService,
    private readonly normalizationService: JobsNormalizationService,
    private readonly redisService: RedisService,
  ) {}

  private get jobAccessLogDelegate(): JobAccessLogDelegate {
    return (this.prisma as PrismaService & { jobAnnouncementAccessLog: JobAccessLogDelegate }).jobAnnouncementAccessLog;
  }

  async getFilters() {
    return {
      degreeOptions: [...FIXED_DEGREE_OPTIONS],
      enterpriseNatureOptions: [...FIXED_ENTERPRISE_NATURE_OPTIONS],
      recruitmentTypeOptions: [...FIXED_RECRUITMENT_TYPE_OPTIONS],
      jobTypeOptions: [...FIXED_RECRUITMENT_TYPE_OPTIONS],
    };
  }

  async getSearchSuggestions(
    query: { keyword?: string; field?: 'general' | 'location' | 'job' | 'company'; limit?: number },
    currentUserId?: string | null,
  ) {
    const keyword = query.keyword?.trim();
    if (!keyword) {
      return { list: [] };
    }

    await this.assertUserCanSearch(currentUserId);

    const limit = Math.min(Math.max(query.limit ?? 8, 1), 12);
    const field = query.field ?? 'general';
    const domainsByField: Record<'general' | 'location' | 'job' | 'company', JobsNormalizationDomain[]> = {
      general: ['COMPANY', 'JOB_TITLE', 'LOCATION'],
      location: ['LOCATION'],
      job: ['JOB_TITLE'],
      company: ['COMPANY'],
    };
    const domainLabels: Record<JobsNormalizationDomain, string> = {
      COMPANY: '企业建议',
      JOB_TITLE: '岗位建议',
      LOCATION: '城市建议',
      MAJOR: '专业建议',
      DEGREE: '学历建议',
    };
    const suggestions = await this.normalizationService.getMultiDomainSuggestions(domainsByField[field], keyword, limit);

    return {
      list: suggestions.map((item) => ({
        value: item.canonical,
        label: item.canonical,
        domain: item.domain,
        domainLabel: domainLabels[item.domain],
        matchText: item.matchedAlias ?? item.canonical,
        relatedKeywords: item.relatedKeywords,
      })),
    };
  }

  async getList(query: QueryJobsDto, currentUserId?: string | null, context?: JobAccessRequestContext) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const access = await this.getMemberAccess(currentUserId);
    this.assertListQueryPermissions(query, access, currentUserId);
    await this.assertNoActiveRiskControl(currentUserId, context);
    await this.evaluateListBrowsingPatterns(
      currentUserId,
      this.buildListRiskContext(query, {
        ...context,
        requestRoute: context?.requestRoute ?? 'list',
        page,
        limit,
      }),
    );
    const where = await this.buildListWhere(query, currentUserId);
    const includeTracking = currentUserId
      ? { trackings: { where: { userId: currentUserId }, take: 1 } }
      : undefined;

    const [list, total] = await this.prisma.$transaction([
      this.prisma.jobAnnouncement.findMany({
        where,
        include: includeTracking,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.jobAnnouncement.count({ where }),
    ]);

    return {
      list: list.map((job) =>
        buildLegacyJobCard(job as JobAnnouncementViewPayload, {
          access: this.buildJobAccessState(job as JobAnnouncementViewPayload, access),
        })),
      pagination: {
        page,
        limit,
        total,
        hasMore: page * limit < total,
      },
    };
  }

  async getRecommendedList(userId: string, query: QueryJobsDto) {
    return this.jobsRecommendationService.getRecommendedList(userId, query);
  }

  async getFreeZoneList(userId: string, context?: JobAccessRequestContext) {
    await this.assertNoActiveRiskControl(userId, context);
    const candidates = await this.prisma.jobAnnouncement.findMany({
      where: { status: 'published' },
      include: { trackings: { where: { userId }, take: 1 } },
      orderBy: { updatedAt: 'desc' },
      take: FREE_ZONE_CANDIDATE_FETCH_LIMIT,
    });
    const list = candidates
      .filter((job) => resolveValidAnnouncementUrl(job.announcementUrl) && resolveValidDeliveryTarget(job.deliveryUrl))
      .slice(0, 20);

    return {
      list: list.map((job) =>
        buildLegacyJobCard(job as JobAnnouncementViewPayload, {
          access: {
            canViewAnnouncement: Boolean(resolveValidAnnouncementUrl(job.announcementUrl)),
            canDeliver: Boolean(resolveValidDeliveryTarget(job.deliveryUrl)),
          },
        })),
      pagination: {
        page: 1,
        limit: 20,
        total: list.length,
        hasMore: false,
      },
    };
  }

  async recordClick(userId: string, id: string, dto: JobsClickDto) {
    await this.ensurePublishedJob(id);
    await this.jobsMetricsService.recordAccessClick(id, dto.actionType);
    invalidateJobsRecommendationCacheByUserId(userId);
    return { recorded: true };
  }

  async viewAnnouncement(userId: string, id: string, context?: JobAccessRequestContext, options?: JobActionAccessOptions) {
    const job = await this.ensurePublishedJob(id);
    const announcementUrl = resolveValidAnnouncementUrl(job.announcementUrl);
    const membershipAudit = await this.getMembershipAuditSnapshot(userId);
    let access: MemberAccessSnapshot | null = null;

    if (!options?.bypassPermission) {
      try {
        access = await assertUserHasMemberPermission(this.prisma, userId, 'jobs:detail:view', '标准会员及以上可查看招聘公告详情');
      } catch (error) {
        await this.createJobAccessAudit({
          jobId: id,
          userId,
          membershipId: membershipAudit.membershipId,
          memberLevel: membershipAudit.memberLevel,
          action: 'view_announcement',
          requestStatus: 'denied',
          failureReason: this.resolveErrorMessage(error, '当前会员权益暂不支持查看招聘公告'),
          context,
        });
        throw error;
      }
    } else {
      access = await this.getMemberAccess(userId);
    }

    try {
      await this.assertActionWithinLimit(userId, 'view_announcement', context);
      await this.evaluateAbnormalPatterns(userId, id, context);
    } catch (error) {
      const isFreeze = error instanceof HttpException && error.getStatus() === HttpStatus.FORBIDDEN;
      const isLimit = error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS;

      await this.createJobAccessAudit({
        jobId: id,
        userId,
        membershipId: membershipAudit.membershipId,
        memberLevel: membershipAudit.memberLevel ?? access?.memberLevel ?? null,
        action: 'view_announcement',
        requestStatus: 'denied',
        limitHit: isLimit,
        riskHit: isFreeze,
        failureReason: this.resolveErrorMessage(error, '查看公告过于频繁，请稍后再试'),
        context,
      });
      throw error;
    }

    if (!announcementUrl) {
      await this.createJobAccessAudit({
        jobId: id,
        userId,
        membershipId: membershipAudit.membershipId,
        memberLevel: membershipAudit.memberLevel ?? access?.memberLevel ?? null,
        action: 'view_announcement',
        requestStatus: 'denied',
        failureReason: '当前岗位暂无公告链接',
        context,
      });
      throw new NotFoundException('当前岗位暂无公告链接');
    }

    await this.jobsMetricsService.recordAccessClick(id, 'view_announcement');
    await this.createJobAccessAudit({
      jobId: id,
      userId,
      membershipId: membershipAudit.membershipId,
      memberLevel: membershipAudit.memberLevel ?? access?.memberLevel ?? null,
      action: 'view_announcement',
      requestStatus: 'consumed',
      redirectTargetType: 'announcement',
      consumedAt: new Date(),
      context,
    });

    return {
      announcementUrl,
      redirectPath: announcementUrl,
    };
  }

  async resolveAnnouncementRedirect(id: string, accessToken?: string, context?: JobAccessRequestContext) {
    const { accessLog } = await this.validateControlledAccessToken(id, accessToken, context, {
      action: 'view_announcement',
      purpose: 'jobs:view-announcement',
      missingTokenMessage: '缺少公告访问凭证',
      invalidTokenMessage: '公告访问凭证无效',
      expiredTokenMessage: '公告访问凭证已失效，请重新申请查看',
      missingAccessLogMessage: '公告访问凭证未签发或已失效',
      usedTokenMessage: '公告访问凭证已被使用，请重新申请查看',
      bindingMismatchMessage: '公告访问凭证与当前设备或会话不一致，请返回岗位列表重新申请',
    });

    const job = await this.ensurePublishedJob(id);
    const announcementUrl = resolveValidAnnouncementUrl(job.announcementUrl);
    if (!announcementUrl) {
      await this.updateJobAccessAudit(accessLog.accessTokenId, {
        requestStatus: 'denied',
        failureReason: '当前岗位暂无公告链接',
        context,
      });
      throw new NotFoundException('当前岗位暂无公告链接');
    }

    await this.updateJobAccessAudit(accessLog.accessTokenId, {
      requestStatus: 'consumed',
      consumedAt: new Date(),
      redirectTargetType: 'announcement',
      context,
    });

    return announcementUrl;
  }

  async getDetail(id: string, currentUserId?: string | null, context?: JobAccessRequestContext) {
    try {
      await this.assertActionWithinLimit(currentUserId, 'detail', context);
    } catch (error) {
      await this.createJobAccessAudit({
        jobId: id,
        userId: currentUserId ?? null,
        action: 'detail',
        requestStatus: 'denied',
        limitHit: error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS,
        riskHit: error instanceof HttpException && error.getStatus() === HttpStatus.FORBIDDEN,
        failureReason: this.resolveErrorMessage(error, '详情访问过于频繁，请稍后再试'),
        context,
      });
      throw error;
    }

    const job = await this.prisma.jobAnnouncement.findUnique({
      where: { id },
      include: currentUserId ? { trackings: { where: { userId: currentUserId }, take: 1 } } : undefined,
    });

    if (!job || job.status !== 'published') {
      await this.createJobAccessAudit({
        jobId: id,
        userId: currentUserId ?? null,
        action: 'detail',
        requestStatus: 'denied',
        failureReason: '岗位不存在',
        context,
      });
      throw new NotFoundException('岗位不存在');
    }

    const access = await this.getMemberAccess(currentUserId);
    await this.createJobAccessAudit({
      jobId: id,
      userId: currentUserId ?? null,
      action: 'detail',
      requestStatus: 'consumed',
      consumedAt: new Date(),
      context,
    });
    return buildLegacyJobCard(job as JobAnnouncementViewPayload, {
      access: this.buildJobAccessState(job as JobAnnouncementViewPayload, access),
    });
  }

  async deliver(userId: string, id: string, context?: JobAccessRequestContext, options?: JobActionAccessOptions) {
    const job = await this.ensurePublishedJob(id);
    const deliveryTarget = resolveValidDeliveryTarget(job.deliveryUrl);
    const membershipAudit = await this.getMembershipAuditSnapshot(userId);
    let access: MemberAccessSnapshot | null = null;

    if (!options?.bypassPermission) {
      try {
        access = await assertUserHasMemberPermission(this.prisma, userId, 'jobs:deliver:use', '标准会员及以上可使用立即投递');
      } catch (error) {
        await this.createJobAccessAudit({
          jobId: id,
          userId,
          membershipId: membershipAudit.membershipId,
          memberLevel: membershipAudit.memberLevel,
          action: 'deliver',
          requestStatus: 'denied',
          failureReason: this.resolveErrorMessage(error, '当前会员权益暂不支持立即投递'),
          context,
        });
        throw error;
      }
    } else {
      access = await this.getMemberAccess(userId);
    }

    try {
      await this.assertActionWithinLimit(userId, 'deliver', context);
      await this.evaluateAbnormalPatterns(userId, id, context);
    } catch (error) {
      const isFreeze = error instanceof HttpException && error.getStatus() === HttpStatus.FORBIDDEN;
      const isLimit = error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS;

      await this.createJobAccessAudit({
        jobId: id,
        userId,
        membershipId: membershipAudit.membershipId,
        memberLevel: membershipAudit.memberLevel ?? access?.memberLevel ?? null,
        action: 'deliver',
        requestStatus: 'denied',
        limitHit: isLimit,
        riskHit: isFreeze,
        failureReason: this.resolveErrorMessage(error, '投递操作过于频繁，请稍后再试'),
        context,
      });
      throw error;
    }

    if (!deliveryTarget) {
      await this.createJobAccessAudit({
        jobId: id,
        userId,
        membershipId: membershipAudit.membershipId,
        memberLevel: membershipAudit.memberLevel ?? access?.memberLevel ?? null,
        action: 'deliver',
        requestStatus: 'denied',
        failureReason: '当前岗位暂无投递入口',
        context,
      });
      throw new NotFoundException('当前岗位暂无投递入口');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const existingTracking = await tx.userJobTracking.findUnique({
        where: { userId_jobId: { userId, jobId: id } },
        select: { progressStatus: true },
      });

      await this.jobsMetricsService.recordAccessClick(id, 'deliver', tx);
      await tx.userJobTracking.upsert({
        where: { userId_jobId: { userId, jobId: id } },
        update: { progressStatus: '已投递' },
        create: { userId, jobId: id, progressStatus: '已投递' },
      });
      await this.jobsMetricsService.recordDeliveryMark(id, existingTracking?.progressStatus, '已投递', tx);

      const deliveryMethod = resolveJobDeliveryMethod(deliveryTarget);
      return {
        deliveryType: deliveryMethod,
        progressStatus: '已投递',
      };
    });

    if (result.deliveryType === 'email') {
      await this.createJobAccessAudit({
        jobId: id,
        userId,
        membershipId: membershipAudit.membershipId,
        memberLevel: membershipAudit.memberLevel ?? access?.memberLevel ?? null,
        action: 'deliver',
        requestStatus: 'consumed',
        redirectTargetType: 'email',
        consumedAt: new Date(),
        context,
      });

      invalidateJobsRecommendationCacheByUserId(userId);
      return {
        action: 'show_email_modal',
        deliveryType: result.deliveryType,
        emailAddress: deliveryTarget,
        deliveryUrl: deliveryTarget,
        progressStatus: result.progressStatus,
      };
    }
    await this.createJobAccessAudit({
      jobId: id,
      userId,
      membershipId: membershipAudit.membershipId,
      memberLevel: membershipAudit.memberLevel ?? access?.memberLevel ?? null,
      action: 'deliver',
      requestStatus: 'consumed',
      consumedAt: new Date(),
      redirectTargetType: result.deliveryType,
      context,
    });

    invalidateJobsRecommendationCacheByUserId(userId);
    return {
      action: 'open_link',
      deliveryType: result.deliveryType,
      deliveryUrl: deliveryTarget,
      redirectPath: deliveryTarget,
      progressStatus: result.progressStatus,
    };
  }

  async resolveDeliveryRedirect(id: string, accessToken?: string, context?: JobAccessRequestContext) {
    const { accessLog } = await this.validateControlledAccessToken(id, accessToken, context, {
      action: 'deliver',
      purpose: 'jobs:deliver',
      missingTokenMessage: '缺少投递访问凭证',
      invalidTokenMessage: '投递访问凭证无效',
      expiredTokenMessage: '投递访问凭证已失效，请重新申请投递',
      missingAccessLogMessage: '投递访问凭证未签发或已失效',
      usedTokenMessage: '投递访问凭证已被使用，请重新申请投递',
      bindingMismatchMessage: '投递访问凭证与当前设备或会话不一致，请返回岗位列表重新申请',
    });

    const job = await this.ensurePublishedJob(id);
    const deliveryTarget = resolveValidDeliveryTarget(job.deliveryUrl);
    if (!deliveryTarget) {
      await this.updateJobAccessAudit(accessLog.accessTokenId, {
        requestStatus: 'denied',
        failureReason: '当前岗位暂无投递入口',
        context,
      });
      throw new NotFoundException('当前岗位暂无投递入口');
    }

    await this.updateJobAccessAudit(accessLog.accessTokenId, {
      requestStatus: 'consumed',
      consumedAt: new Date(),
      redirectTargetType: resolveJobDeliveryMethod(deliveryTarget),
      context,
    });

    return deliveryTarget;
  }

  async updateProgress(userId: string, id: string, dto: UpdateProgressDto, options?: JobActionAccessOptions) {
    await this.ensurePublishedJob(id);
    if (!options?.bypassPermission) {
      await assertUserHasMemberPermission(this.prisma, userId, 'jobs:progress:update', '超级会员可标记求职进度');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const existingTracking = await tx.userJobTracking.findUnique({
        where: { userId_jobId: { userId, jobId: id } },
        select: { progressStatus: true },
      });

      await this.jobsMetricsService.recordAccessClick(id, 'update_progress', tx);
      const tracking = await tx.userJobTracking.upsert({
        where: { userId_jobId: { userId, jobId: id } },
        update: { progressStatus: dto.progressStatus },
        create: { userId, jobId: id, progressStatus: dto.progressStatus },
      });
      await this.jobsMetricsService.recordDeliveryMark(id, existingTracking?.progressStatus, dto.progressStatus, tx);
      return tracking;
    });

    invalidateJobsRecommendationCacheByUserId(userId);
    return result;
  }

  async getReferral(userId: string, id: string, options?: JobActionAccessOptions) {
    const job = await this.ensurePublishedJob(id);
    if (!options?.bypassPermission) {
      await assertUserHasMemberPermission(this.prisma, userId, 'jobs:referral:view', '超级会员可查看内推信息');
    }
    await this.jobsMetricsService.recordAccessClick(id, 'view_referral');

    return {
      hasReferral: Boolean(job.referralCode),
      referralCode: job.referralCode,
      contactHint: job.referralCode ? '复制内推码后前往企业投递入口使用' : '当前岗位暂无内推资源',
    };
  }

  private decodeControlledAccessToken(accessToken: string) {
    const decoded = this.jwtService.decode(accessToken);
    return (decoded && typeof decoded === 'object' ? decoded : null) as ControlledJobAccessTokenPayload | null;
  }

  private resolveErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  private async getMembershipAuditSnapshot(userId: string) {
    const membership = await this.prisma.userMembership.findUnique({
      where: { userId },
      select: {
        id: true,
        memberLevel: true,
      },
    });

    return {
      membershipId: membership?.id ?? null,
      memberLevel: membership?.memberLevel ?? null,
    };
  }

  private async createJobAccessAudit(draft: JobAccessAuditDraft) {
    await this.jobAccessLogDelegate.create({
      data: {
        jobId: draft.jobId,
        userId: draft.userId ?? null,
        membershipId: draft.membershipId ?? null,
        memberLevel: draft.memberLevel ?? null,
        action: draft.action,
        requestStatus: draft.requestStatus,
        accessTokenId: draft.accessTokenId ?? null,
        redirectTargetType: draft.redirectTargetType ?? null,
        limitHit: draft.limitHit ?? false,
        riskHit: draft.riskHit ?? false,
        failureReason: draft.failureReason ?? null,
        consumedAt: draft.consumedAt ?? null,
        expiresAt: draft.expiresAt ?? null,
        ip: draft.context?.ip ?? null,
        userAgent: draft.context?.userAgent ?? null,
        deviceId: draft.context?.deviceId ?? null,
        sessionId: draft.context?.sessionId ?? null,
        reviewStatus: draft.limitHit || draft.riskHit ? 'pending' : 'not_required',
      },
    });
  }

  private async updateJobAccessAudit(accessTokenId: string | null | undefined, draft: Omit<JobAccessAuditDraft, 'jobId' | 'action'>) {
    if (!accessTokenId) {
      return;
    }

    await this.jobAccessLogDelegate.update({
      where: { accessTokenId },
      data: {
        requestStatus: draft.requestStatus,
        redirectTargetType: draft.redirectTargetType ?? undefined,
        limitHit: draft.limitHit,
        riskHit: draft.riskHit,
        failureReason: draft.failureReason ?? undefined,
        consumedAt: draft.consumedAt ?? undefined,
        expiresAt: draft.expiresAt ?? undefined,
        ip: draft.context?.ip ?? undefined,
        userAgent: draft.context?.userAgent ?? undefined,
        deviceId: draft.context?.deviceId ?? undefined,
        sessionId: draft.context?.sessionId ?? undefined,
      },
    });
  }

  private async markControlledAccessFailure(
    payload: ControlledJobAccessTokenPayload | null | undefined,
    requestedJobId: string,
    failureReason: string,
    context?: JobAccessRequestContext,
    requestStatus: 'denied' | 'expired' = 'denied',
  ) {
    if (payload?.tokenId) {
      const existing = await this.jobAccessLogDelegate.findUnique({
        where: { accessTokenId: payload.tokenId },
      });
      if (existing) {
        if (!existing.consumedAt) {
          await this.updateJobAccessAudit(payload.tokenId, {
            requestStatus,
            failureReason,
            context,
          });
        }
        return;
      }
    }

    await this.createJobAccessAudit({
      jobId: payload?.jobId ?? requestedJobId,
      userId: payload?.sub ?? null,
      action: this.resolveAuditActionByPurpose(payload?.purpose),
      requestStatus,
      accessTokenId: payload?.tokenId ?? null,
      failureReason,
      context,
    });
  }

  private assertControlledAccessBinding(
    payload: ControlledJobAccessTokenPayload,
    context: JobAccessRequestContext | undefined,
    failureMessage: string,
  ) {
    if (!payload.deviceIdHash && !payload.sessionIdHash) {
      throw new ForbiddenException(failureMessage);
    }

    const deviceId = context?.deviceId?.trim() || null;
    const sessionId = context?.sessionId?.trim() || null;

    if (payload.deviceIdHash && (!deviceId || this.hashContextIdentifier(deviceId) !== payload.deviceIdHash)) {
      throw new ForbiddenException(failureMessage);
    }
    if (payload.sessionIdHash && (!sessionId || this.hashContextIdentifier(sessionId) !== payload.sessionIdHash)) {
      throw new ForbiddenException(failureMessage);
    }
  }

  private async validateControlledAccessToken(
    id: string,
    accessToken: string | undefined,
    context: JobAccessRequestContext | undefined,
    options: {
      action: JobsAccessAction;
      purpose: ControlledJobAccessTokenPayload['purpose'];
      missingTokenMessage: string;
      invalidTokenMessage: string;
      expiredTokenMessage: string;
      missingAccessLogMessage: string;
      usedTokenMessage: string;
      bindingMismatchMessage: string;
    },
  ) {
    if (!accessToken?.trim()) {
      await this.createJobAccessAudit({
        jobId: id,
        action: options.action,
        requestStatus: 'denied',
        failureReason: options.missingTokenMessage,
        context,
      });
      throw new BadRequestException(options.missingTokenMessage);
    }

    const decodedPayload = this.decodeControlledAccessToken(accessToken);
    let payload: ControlledJobAccessTokenPayload;

    try {
      payload = this.jwtService.verify<ControlledJobAccessTokenPayload>(accessToken);

      if (payload.purpose !== options.purpose || payload.jobId !== id || !payload.sub || !payload.tokenId) {
        await this.markControlledAccessFailure(decodedPayload, id, options.invalidTokenMessage, context);
        throw new BadRequestException(options.invalidTokenMessage);
      }

      this.assertControlledAccessBinding(payload, context, options.bindingMismatchMessage);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof ForbiddenException) {
        await this.markControlledAccessFailure(decodedPayload, id, this.resolveErrorMessage(error, options.bindingMismatchMessage), context);
        throw error;
      }
      await this.markControlledAccessFailure(decodedPayload, id, options.expiredTokenMessage, context, 'expired');
      throw new ForbiddenException(options.expiredTokenMessage);
    }

    const accessLog = await this.jobAccessLogDelegate.findUnique({
      where: { accessTokenId: payload.tokenId },
    });

    if (!accessLog || accessLog.jobId !== id || accessLog.userId !== payload.sub) {
      await this.markControlledAccessFailure(payload, id, options.missingAccessLogMessage, context);
      throw new ForbiddenException(options.invalidTokenMessage);
    }
    if (accessLog.consumedAt || accessLog.requestStatus === 'consumed') {
      throw new ForbiddenException(options.usedTokenMessage);
    }
    if (accessLog.expiresAt && accessLog.expiresAt.getTime() <= Date.now()) {
      await this.updateJobAccessAudit(accessLog.accessTokenId, {
        requestStatus: 'expired',
        failureReason: options.expiredTokenMessage,
        context,
      });
      throw new ForbiddenException(options.expiredTokenMessage);
    }

    return { payload, accessLog };
  }

  private hashContextIdentifier(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private resolveAuditActionByPurpose(purpose?: ControlledJobAccessTokenPayload['purpose'] | null): JobsAccessAction {
    if (purpose === 'jobs:deliver') {
      return 'deliver';
    }
    return 'view_announcement';
  }

  private async getMemberAccess(userId?: string | null) {
    if (!userId) {
      return null;
    }
    return getUserMemberAccess(this.prisma, userId);
  }

  private buildJobAccessState(job: Pick<JobAnnouncementViewPayload, 'announcementUrl' | 'deliveryUrl'>, access: MemberAccessSnapshot | null) {
    const permissionKeys = new Set(access?.permissionKeys ?? []);
    return {
      canViewAnnouncement: Boolean(resolveValidAnnouncementUrl(job.announcementUrl)) && permissionKeys.has('jobs:detail:view'),
      canDeliver: Boolean(resolveValidDeliveryTarget(job.deliveryUrl)) && permissionKeys.has('jobs:deliver:use'),
    };
  }

  private async assertUserCanSearch(userId?: string | null) {
    const access = await this.getMemberAccess(userId);
    if (access?.permissionKeys.includes('jobs:search:use')) {
      return access;
    }
    throw new ForbiddenException('标准会员及以上可使用岗位搜索功能');
  }

  private assertListQueryPermissions(query: QueryJobsDto, access: MemberAccessSnapshot | null, currentUserId?: string | null) {
    const hasSearchRequest = Boolean(
      query.keyword?.trim()
      || query.cityKeyword?.trim()
      || query.companyName?.trim()
      || query.positionName?.trim()
      || query.major?.trim(),
    );
    const hasAdvancedFilterRequest = Boolean(
      query.degreeRequirement?.length
      || query.enterpriseNature?.length
      || query.recruitmentType?.length
      || query.updatedWithinDays?.length
      || query.workLocation?.length
      || query.degree?.length
      || query.jobType?.length,
    );

    if (hasSearchRequest && !access?.permissionKeys.includes('jobs:search:use')) {
      throw new ForbiddenException('标准会员及以上可使用岗位搜索功能');
    }
    if (hasAdvancedFilterRequest && !access?.permissionKeys.includes('jobs:filter:use')) {
      throw new ForbiddenException('标准会员及以上可使用岗位筛选功能');
    }
    if (query.progressStatus && query.progressStatus !== '全部' && !currentUserId) {
      throw new ForbiddenException('登录后才可按求职进度筛选岗位');
    }
  }

  private buildListRiskContext(query: QueryJobsDto, context?: JobAccessRequestContext): JobAccessRequestContext {
    return {
      ...context,
      requestRoute: 'list',
      page: query.page ?? context?.page ?? 1,
      limit: query.limit ?? context?.limit ?? 20,
      filterFingerprint: context?.filterFingerprint ?? this.buildListFilterFingerprint(query),
    };
  }

  private buildListFilterFingerprint(query: QueryJobsDto) {
    const normalized = {
      keyword: query.keyword?.trim() || '',
      cityKeyword: query.cityKeyword?.trim() || '',
      companyName: query.companyName?.trim() || '',
      positionName: query.positionName?.trim() || '',
      major: query.major?.trim() || '',
      degreeRequirement: [...(query.degreeRequirement ?? [])].sort(),
      enterpriseNature: [...(query.enterpriseNature ?? [])].sort(),
      recruitmentType: [...(query.recruitmentType ?? [])].sort(),
      updatedWithinDays: [...(query.updatedWithinDays ?? [])].sort((a, b) => a - b),
      workLocation: [...(query.workLocation ?? [])].sort(),
      degree: [...(query.degree ?? [])].sort(),
      jobType: [...(query.jobType ?? [])].sort(),
      progressStatus: query.progressStatus?.trim() || '',
      userId: query.userId?.trim() || '',
    };
    return createHash('sha256').update(JSON.stringify(normalized)).digest('hex').slice(0, 24);
  }

  private async getJobsRiskRuntimeConfig() {
    return getJobsRiskConfig(this.prisma);
  }

  private resolveActionLimitConfig(riskConfig: JobsRiskConfig, action: JobsAccessAction): JobsAccessLimitActionConfig {
    if (action === 'detail') {
      return riskConfig.accessLimits.detail;
    }
    if (action === 'view_announcement') {
      return riskConfig.accessLimits.viewAnnouncement;
    }
    return riskConfig.accessLimits.deliver;
  }

  private resolveActionExceededMessage(action: JobsAccessAction) {
    if (action === 'detail') {
      return '详情访问过于频繁，请稍后再试';
    }
    if (action === 'view_announcement') {
      return '查看公告过于频繁，请稍后再试';
    }
    return '投递操作过于频繁，请稍后再试';
  }

  private buildActionWindows(config: JobsAccessLimitActionConfig) {
    return [
      { label: '1 分钟', durationMs: 60 * 1000, max: config.perMinute },
      { label: '10 分钟', durationMs: 10 * 60 * 1000, max: config.perTenMinutes },
      { label: '1 小时', durationMs: 60 * 60 * 1000, max: config.perHour },
    ];
  }

  private async assertActionWithinLimit(userId: string | null | undefined, action: JobsAccessAction, context?: JobAccessRequestContext) {
    const riskConfig = await this.getJobsRiskRuntimeConfig();
    const config = this.resolveActionLimitConfig(riskConfig, action);
    const exceededMessage = this.resolveActionExceededMessage(action);
    const now = Date.now();
    const subjects = this.resolveAccessLimitSubjects(userId, context);

    // 1. 检查是否已有生效中的冷却/限制/冻结动作
    await this.assertNoActiveRiskControl(userId, context);

    // 2. 按主体维度检查每日上限
    const today = new Date().toISOString().split('T')[0];
    for (const subject of subjects) {
      const dailyKey = this.buildDailyLimitKey(action, subject.scope, subject.identifier, today);
      const dailyCount = await this.redisService.incr(dailyKey);
      if (dailyCount === 1) {
        await this.redisService.expire(dailyKey, 24 * 60 * 60);
      }

      const dailyMax = this.resolveScopedLimit(config.perDay, subject.scope, riskConfig);
      if (dailyCount > dailyMax) {
        if (subject.scope !== 'session') {
          await this.applyRiskDecision(subject.scope, subject.identifier, {
            level: 2,
            controlType: 'restrict',
            responseStatus: HttpStatus.TOO_MANY_REQUESTS,
            reason: '今日操作额度已达上限，已进入临时限制查看',
            durationSeconds: riskConfig.controls.dailyQuotaExceeded.restrictSeconds,
            ruleKey: 'daily_quota_exceeded',
          });
        }
        throw new HttpException(`${exceededMessage}，今日额度已用完`, HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    // 3. 按主体维度检查滑动窗口频控
    for (const subject of subjects) {
      for (const windowConfig of this.buildActionWindows(config)) {
        const windowKey = this.buildWindowLimitKey(action, subject.scope, subject.identifier, windowConfig.durationMs);
        const minScore = now - windowConfig.durationMs;

        await this.redisService.zadd(windowKey, now, `${now}-${randomUUID()}`);
        await this.redisService.zremrangebyscore(windowKey, 0, minScore);
        const count = await this.redisService.zcard(windowKey);
        await this.redisService.expire(windowKey, Math.ceil(windowConfig.durationMs / 1000) + 60);

        const scopedMax = this.resolveScopedLimit(windowConfig.max, subject.scope, riskConfig);
        if (count > scopedMax) {
          await this.trackLimitHit(userId, riskConfig, context);
          throw new HttpException(
            `${exceededMessage}，${windowConfig.label}内最多 ${scopedMax} 次`,
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }
    }
  }

  private resolveAccessLimitSubjects(userId?: string | null, context?: JobAccessRequestContext): JobAccessLimitSubject[] {
    const subjects: JobAccessLimitSubject[] = [];
    if (userId) {
      subjects.push({ scope: 'user', identifier: userId });
    }
    if (context?.ip) {
      subjects.push({ scope: 'ip', identifier: context.ip });
    }
    if (context?.deviceId) {
      subjects.push({ scope: 'device', identifier: context.deviceId });
    }
    if (context?.sessionId) {
      subjects.push({ scope: 'session', identifier: context.sessionId });
    }
    return subjects;
  }

  private resolveRiskSubjects(userId?: string | null, context?: JobAccessRequestContext): JobRiskSubject[] {
    const subjects: JobRiskSubject[] = [];
    if (userId) {
      subjects.push({ scope: 'user', identifier: userId });
    }
    if (context?.ip) {
      subjects.push({ scope: 'ip', identifier: context.ip });
    }
    if (context?.deviceId) {
      subjects.push({ scope: 'device', identifier: context.deviceId });
    }
    if (context?.sessionId) {
      subjects.push({ scope: 'session', identifier: context.sessionId });
    }
    return subjects;
  }

  private resolveScopedLimit(baseLimit: number, scope: JobAccessLimitScope, riskConfig: JobsRiskConfig) {
    return Math.max(1, Math.ceil(baseLimit * riskConfig.accessLimits.scopeMultiplier[scope]));
  }

  private buildDailyLimitKey(action: JobsAccessAction, scope: JobAccessLimitScope, identifier: string, day: string) {
    return `jobs:limit:daily:${action}:${scope}:${identifier}:${day}`;
  }

  private buildWindowLimitKey(action: JobsAccessAction, scope: JobAccessLimitScope, identifier: string, durationMs: number) {
    return `jobs:limit:window:${action}:${scope}:${identifier}:${durationMs}`;
  }

  private async evaluateAbnormalPatterns(userId: string, jobId: string, context?: JobAccessRequestContext) {
    const riskConfig = await this.getJobsRiskRuntimeConfig();

    await this.trackDistinctJobBurst('user', userId, jobId, riskConfig, '短时间访问过多不同岗位');
    await this.trackSequentialJobEnumeration('user', userId, jobId, riskConfig, '检测到短时间顺序枚举岗位 ID');

    if (context?.ip) {
      await this.trackDistinctJobBurst('ip', context.ip, jobId, riskConfig, '同一 IP 短时间访问过多不同岗位');
      await this.trackSharedIpUsers(context.ip, userId, riskConfig);
      await this.trackUserIpRotation(userId, context.ip, riskConfig);
      await this.trackSequentialJobEnumeration('ip', context.ip, jobId, riskConfig, '检测到同一 IP 短时间顺序枚举岗位 ID');
    }

    if (context?.deviceId) {
      await this.trackDistinctJobBurst('device', context.deviceId, jobId, riskConfig, '同一设备短时间访问过多不同岗位');
      await this.trackSharedDeviceUsers(context.deviceId, userId, riskConfig);
      await this.trackSequentialJobEnumeration('device', context.deviceId, jobId, riskConfig, '检测到同一设备短时间顺序枚举岗位 ID');
    }

    if (context?.sessionId) {
      await this.trackSequentialJobEnumeration('session', context.sessionId, jobId, riskConfig, '检测到同一会话短时间顺序枚举岗位 ID');
    }

    await this.trackNightBurst('user', userId, riskConfig, '深夜持续高频访问');
    if (context?.ip) {
      await this.trackNightBurst('ip', context.ip, riskConfig, '深夜同一 IP 持续高频访问');
    }
    if (context?.deviceId) {
      await this.trackNightBurst('device', context.deviceId, riskConfig, '深夜同一设备持续高频访问');
    }
  }

  private async evaluateListBrowsingPatterns(userId?: string | null, context?: JobAccessRequestContext) {
    if (!context?.page || context.page <= 1) {
      return;
    }

    const riskConfig = await this.getJobsRiskRuntimeConfig();
    const subjects = this.resolveRiskSubjects(userId, context);
    for (const subject of subjects) {
      await this.trackRegularPageScan(subject.scope, subject.identifier, context, riskConfig);
    }
  }

  private async trackDistinctJobBurst(scope: JobFreezeScope, identifier: string, jobId: string, riskConfig: JobsRiskConfig, reason: string) {
    const key = `jobs:risk:distinct-job:${scope}:${identifier}`;
    await this.redisService.sadd(key, jobId);
    await this.redisService.expire(key, riskConfig.controls.distinctJobBurst.windowSeconds);
    const count = (await this.redisService.smembers(key)).length;
    if (count >= riskConfig.controls.distinctJobBurst[`${scope}Threshold`]) {
      await this.applyRiskDecision(scope, identifier, {
        level: 2,
        controlType: 'restrict',
        responseStatus: HttpStatus.FORBIDDEN,
        reason: `${reason}，已进入临时限制查看`,
        durationSeconds: riskConfig.controls.distinctJobBurst.restrictSeconds,
        ruleKey: 'distinct_job_burst',
        evidence: `distinctJobs=${count}`,
      });
      throw new HttpException(reason, HttpStatus.FORBIDDEN);
    }
  }

  private async trackNightBurst(scope: JobFreezeScope, identifier: string, riskConfig: JobsRiskConfig, reason: string) {
    if (!this.isDeepNightWindow(riskConfig)) {
      return;
    }
    const key = `jobs:risk:night:${scope}:${identifier}`;
    const count = await this.redisService.incr(key);
    if (count === 1) {
      await this.redisService.expire(key, riskConfig.controls.nightBurst.windowSeconds);
    }
    if (count >= riskConfig.controls.nightBurst[`${scope}Threshold`]) {
      await this.applyRiskDecision(scope, identifier, {
        level: 3,
        controlType: 'freeze',
        responseStatus: HttpStatus.FORBIDDEN,
        reason,
        durationSeconds: riskConfig.controls.nightBurst.freezeSeconds,
        ruleKey: 'night_burst',
        evidence: `count=${count}`,
      });
      throw new HttpException(reason, HttpStatus.FORBIDDEN);
    }
  }

  private async trackSharedIpUsers(ip: string, userId: string, riskConfig: JobsRiskConfig) {
    const key = `jobs:risk:shared-ip-users:${ip}`;
    await this.redisService.sadd(key, userId);
    await this.redisService.expire(key, riskConfig.controls.sharedIpUsers.windowSeconds);
    const distinctUserCount = (await this.redisService.smembers(key)).length;
    if (distinctUserCount >= riskConfig.controls.sharedIpUsers.threshold) {
      await this.applyRiskDecision('ip', ip, {
        level: 3,
        controlType: 'freeze',
        responseStatus: HttpStatus.FORBIDDEN,
        reason: '检测到多账号共用同一 IP 高频访问',
        durationSeconds: riskConfig.controls.sharedIpUsers.freezeSeconds,
        ruleKey: 'shared_ip_users',
        evidence: `distinctUsers=${distinctUserCount}`,
      });
      throw new HttpException('检测到多账号共用同一 IP 高频访问', HttpStatus.FORBIDDEN);
    }
  }

  private async trackSharedDeviceUsers(deviceId: string, userId: string, riskConfig: JobsRiskConfig) {
    const key = `jobs:risk:shared-device-users:${deviceId}`;
    await this.redisService.sadd(key, userId);
    await this.redisService.expire(key, riskConfig.controls.sharedDeviceUsers.windowSeconds);
    const distinctUserCount = (await this.redisService.smembers(key)).length;
    if (distinctUserCount >= riskConfig.controls.sharedDeviceUsers.threshold) {
      await this.applyRiskDecision('device', deviceId, {
        level: 3,
        controlType: 'freeze',
        responseStatus: HttpStatus.FORBIDDEN,
        reason: '检测到多账号共用同一设备高频访问',
        durationSeconds: riskConfig.controls.sharedDeviceUsers.freezeSeconds,
        ruleKey: 'shared_device_users',
        evidence: `distinctUsers=${distinctUserCount}`,
      });
      throw new HttpException('检测到多账号共用同一设备高频访问', HttpStatus.FORBIDDEN);
    }
  }

  private async trackUserIpRotation(userId: string, ip: string, riskConfig: JobsRiskConfig) {
    const key = `jobs:risk:user-ip-rotation:${userId}`;
    await this.redisService.sadd(key, ip);
    await this.redisService.expire(key, riskConfig.controls.userIpRotation.windowSeconds);
    const distinctIpCount = (await this.redisService.smembers(key)).length;
    if (distinctIpCount >= riskConfig.controls.userIpRotation.threshold) {
      await this.applyRiskDecision('user', userId, {
        level: 3,
        controlType: 'freeze',
        responseStatus: HttpStatus.FORBIDDEN,
        reason: '检测到同一账号短时间轮换多个 IP 访问',
        durationSeconds: riskConfig.controls.userIpRotation.freezeSeconds,
        ruleKey: 'user_ip_rotation',
        evidence: `distinctIps=${distinctIpCount}`,
      });
      throw new HttpException('检测到同一账号短时间轮换多个 IP 访问', HttpStatus.FORBIDDEN);
    }
  }

  private async trackSequentialJobEnumeration(
    scope: JobAccessLimitScope,
    identifier: string,
    jobId: string,
    riskConfig: JobsRiskConfig,
    reason: string,
  ) {
    const now = Date.now();
    const key = `jobs:risk:job-enumeration:${scope}:${identifier}`;
    await this.redisService.zadd(key, now, `${now}:${jobId}:${randomUUID()}`);
    await this.redisService.zremrangebyscore(key, 0, now - riskConfig.controls.jobEnumeration.windowSeconds);
    await this.redisService.expire(key, riskConfig.controls.jobEnumeration.windowSeconds);
    const members = await this.redisService.zrange(key, 0, -1);
    const threshold = riskConfig.controls.jobEnumeration[`${scope}Threshold`];
    const recentJobIds = members
      .slice(-threshold)
      .map((member) => member.split(':')[1])
      .filter(Boolean);

    if (recentJobIds.length < threshold) {
      return;
    }

    const isSequentialEnumeration = recentJobIds.every((current, index, list) => index === 0 || current !== list[index - 1])
      && new Set(recentJobIds).size === recentJobIds.length;
    if (!isSequentialEnumeration) {
      return;
    }

    if (scope === 'session') {
      throw new HttpException(`${reason}，当前会话已进入冷却`, HttpStatus.TOO_MANY_REQUESTS);
    }

    await this.applyRiskDecision(scope, identifier, {
      level: 2,
      controlType: 'restrict',
      responseStatus: HttpStatus.FORBIDDEN,
      reason: `${reason}，已进入临时限制查看`,
      durationSeconds: riskConfig.controls.jobEnumeration.restrictSeconds,
      ruleKey: 'job_enumeration',
      evidence: `recentJobIds=${recentJobIds.join(',')}`,
    });
    throw new HttpException(reason, HttpStatus.FORBIDDEN);
  }

  private async trackRegularPageScan(
    scope: JobAccessLimitScope,
    identifier: string,
    context: JobAccessRequestContext,
    riskConfig: JobsRiskConfig,
  ) {
    const fingerprint = context.filterFingerprint || 'default';
    const page = context.page ?? 1;
    const now = Date.now();
    const key = `jobs:risk:page-scan:${scope}:${identifier}:${fingerprint}`;
    await this.redisService.zadd(key, now, `${now}:${page}:${randomUUID()}`);
    await this.redisService.zremrangebyscore(key, 0, now - riskConfig.controls.regularPageScan.windowSeconds);
    await this.redisService.expire(key, riskConfig.controls.regularPageScan.windowSeconds);
    const members = await this.redisService.zrange(key, 0, -1);
    const threshold = riskConfig.controls.regularPageScan[`${scope}Threshold`];
    const recentRecords = members.slice(-threshold).map((member) => {
      const [timestampText, pageText] = member.split(':');
      return {
        timestamp: Number(timestampText),
        page: Number(pageText),
      };
    }).filter((item) => Number.isFinite(item.timestamp) && Number.isFinite(item.page));

    if (recentRecords.length < threshold) {
      return;
    }

    const hasMonotonicPages = recentRecords.every((current, index, list) => index === 0 || current.page === list[index - 1].page + 1);
    const maxGapMs = recentRecords
      .slice(1)
      .reduce((maxGap, current, index) => Math.max(maxGap, current.timestamp - recentRecords[index].timestamp), 0);
    const hasRegularCadence = maxGapMs > 0 && maxGapMs <= riskConfig.controls.regularPageScan.maxGapSeconds * 1000;

    if (!hasMonotonicPages || !hasRegularCadence) {
      return;
    }

    const reason = '检测到规律性翻页抓取行为';
    if (scope === 'session') {
      throw new HttpException(`${reason}，当前会话已进入冷却`, HttpStatus.TOO_MANY_REQUESTS);
    }

    await this.applyRiskDecision(scope, identifier, {
      level: 1,
      controlType: 'cooldown',
      responseStatus: HttpStatus.TOO_MANY_REQUESTS,
      reason: `${reason}，已进入冷却观察`,
      durationSeconds: riskConfig.controls.regularPageScan.cooldownSeconds,
      ruleKey: 'regular_page_scan',
      evidence: `page=${page};fingerprint=${fingerprint}`,
    });
    throw new HttpException(`${reason}，请稍后再试`, HttpStatus.TOO_MANY_REQUESTS);
  }

  private isDeepNightWindow(riskConfig: JobsRiskConfig, now = new Date()) {
    const hour = now.getHours();
    const { startHour, endHour } = riskConfig.controls.nightBurst;
    if (startHour === endHour) {
      return true;
    }
    if (startHour < endHour) {
      return hour >= startHour && hour < endHour;
    }
    return hour >= startHour || hour < endHour;
  }

  private async assertNoActiveRiskControl(userId?: string | null, context?: JobAccessRequestContext) {
    if (userId) {
      const userFreezeReason = await this.redisService.get(this.buildFreezeKey('user', userId));
      if (userFreezeReason) {
        throw new HttpException(`账号行为异常已临时冻结：${this.readFreezeReason(userFreezeReason)}`, HttpStatus.FORBIDDEN);
      }
      const userRestrictReason = await this.redisService.get(this.buildRiskControlKey('restrict', 'user', userId));
      if (userRestrictReason) {
        throw new HttpException(`账号访问已被临时限制：${this.readFreezeReason(userRestrictReason)}`, HttpStatus.FORBIDDEN);
      }
      const userCooldownReason = await this.redisService.get(this.buildRiskControlKey('cooldown', 'user', userId));
      if (userCooldownReason) {
        throw new HttpException(`账号请求过快，当前处于冷却观察：${this.readFreezeReason(userCooldownReason)}`, HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    if (context?.ip) {
      const ipFreezeReason = await this.redisService.get(this.buildFreezeKey('ip', context.ip));
      if (ipFreezeReason) {
        throw new HttpException(`当前 IP 行为异常已临时冻结：${this.readFreezeReason(ipFreezeReason)}`, HttpStatus.FORBIDDEN);
      }
      const ipRestrictReason = await this.redisService.get(this.buildRiskControlKey('restrict', 'ip', context.ip));
      if (ipRestrictReason) {
        throw new HttpException(`当前 IP 访问已被临时限制：${this.readFreezeReason(ipRestrictReason)}`, HttpStatus.FORBIDDEN);
      }
      const ipCooldownReason = await this.redisService.get(this.buildRiskControlKey('cooldown', 'ip', context.ip));
      if (ipCooldownReason) {
        throw new HttpException(`当前 IP 请求过快，已进入冷却观察：${this.readFreezeReason(ipCooldownReason)}`, HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    if (context?.deviceId) {
      const deviceFreezeReason = await this.redisService.get(this.buildFreezeKey('device', context.deviceId));
      if (deviceFreezeReason) {
        throw new HttpException(`当前设备行为异常已临时冻结：${this.readFreezeReason(deviceFreezeReason)}`, HttpStatus.FORBIDDEN);
      }
      const deviceRestrictReason = await this.redisService.get(this.buildRiskControlKey('restrict', 'device', context.deviceId));
      if (deviceRestrictReason) {
        throw new HttpException(`当前设备访问已被临时限制：${this.readFreezeReason(deviceRestrictReason)}`, HttpStatus.FORBIDDEN);
      }
      const deviceCooldownReason = await this.redisService.get(this.buildRiskControlKey('cooldown', 'device', context.deviceId));
      if (deviceCooldownReason) {
        throw new HttpException(`当前设备请求过快，已进入冷却观察：${this.readFreezeReason(deviceCooldownReason)}`, HttpStatus.TOO_MANY_REQUESTS);
      }
    }
  }

  private async trackLimitHit(userId: string | null | undefined, riskConfig: JobsRiskConfig, context?: JobAccessRequestContext) {
    if (!userId) {
      return;
    }
    const hitKey = `jobs:limit:hits:${userId}`;
    const hits = await this.redisService.incr(hitKey);
    if (hits === 1) {
      await this.redisService.expire(hitKey, riskConfig.controls.repeatedLimitHits.windowSeconds);
    }
    if (hits >= riskConfig.controls.repeatedLimitHits.userThreshold) {
      await this.applyRiskDecision('user', userId, {
        level: 1,
        controlType: 'cooldown',
        responseStatus: HttpStatus.TOO_MANY_REQUESTS,
        reason: '短时间内多次触发频控限制，已进入冷却观察',
        durationSeconds: riskConfig.controls.repeatedLimitHits.userCooldownSeconds,
        ruleKey: 'repeated_limit_hits',
        evidence: `hits=${hits}`,
      });
    }

    if (context?.ip) {
      const ipHitKey = `jobs:limit:hits:ip:${context.ip}`;
      const ipHits = await this.redisService.incr(ipHitKey);
      if (ipHits === 1) {
        await this.redisService.expire(ipHitKey, riskConfig.controls.repeatedLimitHits.windowSeconds);
      }
      if (ipHits >= riskConfig.controls.repeatedLimitHits.ipThreshold) {
        await this.applyRiskDecision('ip', context.ip, {
          level: 2,
          controlType: 'restrict',
          responseStatus: HttpStatus.TOO_MANY_REQUESTS,
          reason: '当前 IP 短时间内多次触发频控限制，已进入临时限制查看',
          durationSeconds: riskConfig.controls.repeatedLimitHits.ipRestrictSeconds,
          ruleKey: 'repeated_limit_hits',
          evidence: `hits=${ipHits}`,
        });
      }
    }

    if (context?.deviceId) {
      const deviceHitKey = `jobs:limit:hits:device:${context.deviceId}`;
      const deviceHits = await this.redisService.incr(deviceHitKey);
      if (deviceHits === 1) {
        await this.redisService.expire(deviceHitKey, riskConfig.controls.repeatedLimitHits.windowSeconds);
      }
      if (deviceHits >= riskConfig.controls.repeatedLimitHits.deviceThreshold) {
        await this.applyRiskDecision('device', context.deviceId, {
          level: 2,
          controlType: 'restrict',
          responseStatus: HttpStatus.TOO_MANY_REQUESTS,
          reason: '当前设备短时间内多次触发频控限制，已进入临时限制查看',
          durationSeconds: riskConfig.controls.repeatedLimitHits.deviceRestrictSeconds,
          ruleKey: 'repeated_limit_hits',
          evidence: `hits=${deviceHits}`,
        });
      }
    }
  }

  private buildFreezeKey(scope: 'user' | 'ip' | 'device', identifier: string) {
    return `jobs:freeze:${scope}:${identifier}`;
  }

  private buildRiskControlKey(controlType: Exclude<JobRiskControlType, 'freeze'>, scope: 'user' | 'ip' | 'device', identifier: string) {
    return `jobs:risk:control:${controlType}:${scope}:${identifier}`;
  }

  private async applyRiskDecision(
    scope: 'user' | 'ip' | 'device',
    identifier: string,
    decision: JobRiskDecision,
    options?: {
      source?: 'automatic' | 'manual';
    },
  ) {
    const effectiveDecision = await this.maybeEscalateRiskDecision(scope, identifier, decision);
    const payload = JSON.stringify({
      reason: effectiveDecision.reason,
      createdAt: new Date().toISOString(),
      source: options?.source ?? 'automatic',
      ruleKey: effectiveDecision.ruleKey,
      evidence: effectiveDecision.evidence ?? null,
      level: effectiveDecision.level,
      controlType: effectiveDecision.controlType,
    } satisfies JobFreezePayload);

    if (effectiveDecision.controlType === 'freeze') {
      const freezeKey = this.buildFreezeKey(scope, identifier);
      await this.redisService.set(freezeKey, payload, effectiveDecision.durationSeconds);
      await this.redisService.sadd(JOB_RISK_FREEZE_REGISTRY_KEY, freezeKey);
      return effectiveDecision;
    }

    const controlKey = this.buildRiskControlKey(effectiveDecision.controlType, scope, identifier);
    await this.redisService.set(controlKey, payload, effectiveDecision.durationSeconds);
    await this.redisService.sadd(JOB_RISK_CONTROL_REGISTRY_KEY, controlKey);
    return effectiveDecision;
  }

  private async maybeEscalateRiskDecision(scope: 'user' | 'ip' | 'device', identifier: string, decision: JobRiskDecision) {
    if (decision.level < 2 || decision.ruleKey === 'compound_risk_escalation') {
      return decision;
    }

    const riskConfig = await this.getJobsRiskRuntimeConfig();
    const distinctRuleKey = `jobs:risk:escalation:rules:${scope}:${identifier}`;
    const hitCountKey = `jobs:risk:escalation:hits:${scope}:${identifier}`;
    await this.redisService.sadd(distinctRuleKey, decision.ruleKey);
    await this.redisService.expire(distinctRuleKey, riskConfig.controls.escalation.windowSeconds);
    const distinctRuleCount = (await this.redisService.smembers(distinctRuleKey)).length;
    const hitCount = await this.redisService.incr(hitCountKey);
    if (hitCount === 1) {
      await this.redisService.expire(hitCountKey, riskConfig.controls.escalation.windowSeconds);
    }

    if (
      distinctRuleCount < riskConfig.controls.escalation.distinctRuleThreshold
      && !(decision.level >= 3 && hitCount >= riskConfig.controls.escalation.severeHitThreshold)
    ) {
      return decision;
    }

    return {
      level: 4,
      controlType: 'freeze',
      responseStatus: HttpStatus.FORBIDDEN,
      reason: '命中多个异常规则且反复触发，已升级为四级高风险并进入人工审核',
      durationSeconds: riskConfig.controls.escalation.freezeSeconds,
      ruleKey: 'compound_risk_escalation',
      evidence: `rules=${distinctRuleCount};hits=${hitCount};lastRule=${decision.ruleKey}`,
    } satisfies JobRiskDecision;
  }

  private readFreezeReason(rawValue: string) {
    try {
      const parsed = JSON.parse(rawValue) as Partial<JobFreezePayload>;
      return typeof parsed.reason === 'string' && parsed.reason.trim() ? parsed.reason.trim() : rawValue;
    } catch {
      return rawValue;
    }
  }

  private async buildListWhere(query: QueryJobsDto, currentUserId?: string | null): Promise<Prisma.JobAnnouncementWhereInput> {
    const where = await this.buildBaseWhere(query);

    if (currentUserId && query.progressStatus && query.progressStatus !== '全部') {
      where.trackings = {
        some: {
          userId: currentUserId,
          progressStatus: query.progressStatus,
        },
      };
    }

    return where;
  }

  private async buildBaseWhere(query: QueryJobsDto): Promise<Prisma.JobAnnouncementWhereInput> {
    const and: Prisma.JobAnnouncementWhereInput[] = [{ status: 'published' }];

    const generalKeywordFilter = await this.buildGeneralKeywordFilter(query.keyword);
    if (generalKeywordFilter) {
      and.push(generalKeywordFilter);
    }

    const cityKeywordFilter = await this.buildLocationKeywordFilter(query.cityKeyword);
    if (cityKeywordFilter) {
      and.push(cityKeywordFilter);
    }

    const companyKeywordFilter = await this.buildDomainKeywordFilter(['companyFullName', 'announcementTitle'], query.companyName, ['COMPANY']);
    if (companyKeywordFilter) {
      and.push(companyKeywordFilter);
    }

    const positionKeywordFilter = await this.buildDomainKeywordFilter(['jobName', 'announcementTitle'], query.positionName, ['JOB_TITLE']);
    if (positionKeywordFilter) {
      and.push(positionKeywordFilter);
    }

    const majorKeywordFilter = await this.buildDomainKeywordFilter(['majorRequirement', 'announcementTitle', 'industry', 'graduationSession'], query.major, ['MAJOR']);
    if (majorKeywordFilter) {
      and.push(majorKeywordFilter);
    }

    const degreeValues = this.expandFilterAliases(
      this.mergeFilterValues(query.degreeRequirement, query.degree),
      DEGREE_FILTER_ALIASES,
    );
    const degreeFilter = this.buildMultiContainsFieldFilter('degreeRequirement', degreeValues);
    if (degreeFilter) {
      and.push(degreeFilter);
    }

    const enterpriseNatureFilter = this.buildEnterpriseNatureFilter(query.enterpriseNature);
    if (enterpriseNatureFilter) {
      and.push(enterpriseNatureFilter);
    }

    const recruitmentTypeValues = this.expandFilterAliases(
      this.mergeFilterValues(query.recruitmentType, query.jobType),
      RECRUITMENT_TYPE_FILTER_ALIASES,
    );
    const recruitmentTypeFilter = this.buildMultiContainsFieldFilter('recruitmentType', recruitmentTypeValues);
    if (recruitmentTypeFilter) {
      and.push(recruitmentTypeFilter);
    }

    const legacyLocationFilter = this.buildMultiContainsFieldFilter('workLocation', query.workLocation);
    if (legacyLocationFilter) {
      and.push(legacyLocationFilter);
    }

    if (query.updatedWithinDays?.length) {
      const days = Math.max(...query.updatedWithinDays);
      const cutoffDate = subDays(new Date(), days);
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0]; // YYYY-MM-DD 格式

      // 时间筛选以【更新时间】字段为唯一判断依据
      // entryDate是字符串格式(YYYY-MM-DD)，updatedAt是DateTime格式
      // 满足以下任一条件即符合筛选：
      // 1. entryDate存在且 >= 截断日期（字符串比较）
      // 2. entryDate为空且 updatedAt >= 截断日期
      and.push({
        OR: [
          { entryDate: { gte: cutoffDateStr } },
          { AND: [{ entryDate: null }, { updatedAt: { gte: cutoffDate } }] },
        ],
      });
    }

    return and.length === 1 ? and[0] : { AND: and };
  }

  private async buildLocationKeywordFilter(keyword?: string): Promise<Prisma.JobAnnouncementWhereInput | null> {
    const normalizedKeyword = keyword?.trim();
    if (!normalizedKeyword) {
      return null;
    }

    const locationPreferences = await this.normalizationService.normalizeLocationPreferences([normalizedKeyword]);
    if (!locationPreferences.length) {
      return { workLocation: { contains: normalizedKeyword } };
    }

    const preference = locationPreferences[0];
    const clauses = buildLocationRecallClauses(preference);
    const exactConditions = this.uniqueWhereConditions([
      { workLocation: { contains: normalizedKeyword } },
      ...clauses.exactKeywords.map((kw) => ({ workLocation: { contains: kw } } as Prisma.JobAnnouncementWhereInput)),
    ]);

    if (!clauses.parentProvinceKeywords.length) {
      return exactConditions.length === 1 ? exactConditions[0] : { OR: exactConditions };
    }

    return {
      OR: [
        ...exactConditions,
        ...clauses.parentProvinceKeywords.map((parentProvinceKeyword) => ({
          AND: [
            { workLocation: { contains: parentProvinceKeyword } },
            ...(clauses.siblingCityKeywords.length
              ? [{ NOT: clauses.siblingCityKeywords.map((city) => ({ workLocation: { contains: city } })) }]
              : []),
          ],
        })),
      ],
    };
  }

  private async buildGeneralKeywordFilter(keyword?: string) {
    return this.buildDomainKeywordFilter(
      [...GENERAL_SEARCH_FIELDS],
      keyword,
      ['COMPANY', 'JOB_TITLE', 'LOCATION', 'MAJOR', 'DEGREE'],
    );
  }

  private async buildDomainKeywordFilter(fields: GeneralSearchField[], keyword: string | undefined, domains: JobsNormalizationDomain[]) {
    const expandedKeywords = await this.expandSearchKeywords(keyword, domains);
    if (!expandedKeywords.length) {
      return null;
    }

    const conditions = expandedKeywords.flatMap((item) =>
      fields.map((field) => ({ [field]: { contains: item } } as Prisma.JobAnnouncementWhereInput)),
    );
    const uniqueConditions = this.uniqueWhereConditions(conditions);
    return uniqueConditions.length === 1 ? uniqueConditions[0] : ({ OR: uniqueConditions } satisfies Prisma.JobAnnouncementWhereInput);
  }

  private buildMultiContainsFieldFilter(field: GeneralSearchField, values?: string[]) {
    const normalizedValues = this.uniqueFilterValues(values ?? []);
    if (!normalizedValues.length) {
      return null;
    }

    const conditions = normalizedValues.map((value) => ({ [field]: { contains: value } } as Prisma.JobAnnouncementWhereInput));
    return conditions.length === 1 ? conditions[0] : { OR: conditions };
  }

  private buildEnterpriseNatureFilter(values?: string[]) {
    const normalizedValues = this.uniqueFilterValues(values ?? []);
    if (!normalizedValues.length) {
      return null;
    }

    const specificKeywords = this.expandFilterAliases(
      normalizedValues.filter((value) => value !== '其他'),
      ENTERPRISE_NATURE_FILTER_ALIASES,
    );
    const conditions = specificKeywords.map((value) => ({ enterpriseNature: { contains: value } } as Prisma.JobAnnouncementWhereInput));

    if (normalizedValues.includes('其他')) {
      conditions.push({
        AND: [
          { enterpriseNature: { not: null } },
          { NOT: ENTERPRISE_NATURE_KNOWN_KEYWORDS.map((keyword) => ({ enterpriseNature: { contains: keyword } } as Prisma.JobAnnouncementWhereInput)) },
        ],
      } satisfies Prisma.JobAnnouncementWhereInput);
    }

    const uniqueConditions = this.uniqueWhereConditions(conditions);
    return uniqueConditions.length === 1 ? uniqueConditions[0] : ({ OR: uniqueConditions } satisfies Prisma.JobAnnouncementWhereInput);
  }

  private mergeFilterValues(...groups: Array<string[] | undefined>) {
    return groups.flatMap((group) => group ?? []);
  }

  private expandFilterAliases(values: string[] | undefined, aliases: Record<string, string[]>) {
    const normalizedValues = this.uniqueFilterValues(values ?? []);
    return this.uniqueFilterValues(
      normalizedValues.flatMap((value) => aliases[value] ?? [value]),
    );
  }

  private async expandSearchKeywords(keyword: string | undefined, domains: JobsNormalizationDomain[]) {
    const normalizedKeyword = keyword?.trim();
    if (!normalizedKeyword) {
      return [];
    }

    const expandedGroups = await Promise.all(domains.map((domain) => this.normalizationService.expandSearchKeywords(domain, normalizedKeyword)));
    return this.uniqueFilterValues([normalizedKeyword, ...expandedGroups.flat()]);
  }

  private uniqueWhereConditions(conditions: Prisma.JobAnnouncementWhereInput[]) {
    const deduped = new Map<string, Prisma.JobAnnouncementWhereInput>();
    conditions.forEach((condition) => {
      deduped.set(JSON.stringify(condition), condition);
    });
    return Array.from(deduped.values());
  }

  private uniqueFilterValues(values: Array<string | null | undefined>) {
    return Array.from(new Set(values.map((item) => item?.trim()).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  }

  private async ensurePublishedJob(id: string): Promise<JobAnnouncement> {
    const job = await this.prisma.jobAnnouncement.findUnique({ where: { id } });
    if (!job || job.status !== 'published') {
      throw new NotFoundException('岗位不存在');
    }
    return job;
  }
}
