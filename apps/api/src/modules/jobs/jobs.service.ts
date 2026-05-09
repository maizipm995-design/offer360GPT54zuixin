import { Injectable, NotFoundException } from '@nestjs/common';
import { JobAnnouncement, Prisma } from '@prisma/client';
import { assertUserHasMemberPermission } from '../../common/utils/member-access';
import { PrismaService } from '../../prisma.service';
import { JobsClickDto } from './dto/jobs-click.dto';
import { QueryJobsDto } from './dto/query-jobs.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { buildLegacyJobCard, resolveJobDeliveryMethod, type JobAnnouncementViewPayload } from './job-announcement-view';
import { invalidateJobsRecommendationCacheByUserId } from './jobs-recommendation-cache';
import { JobsMetricsService } from './jobs-metrics.service';
import { JobsRecommendationService } from './jobs-recommendation.service';
import { subDays } from './jobs.utils';

const GENERAL_SEARCH_FIELDS = [
  'companyFullName',
  'enterpriseNature',
  'degreeRequirement',
  'workLocation',
  'jobName',
  'jobCategory',
  'recruitmentType',
  'deadlineAt',
  'announcementUrl',
  'deliveryUrl',
  'graduationSession',
  'referralCode',
  'announcementTitle',
  'industry',
  'entryDate',
  'status',
] as const;

type GeneralSearchField = (typeof GENERAL_SEARCH_FIELDS)[number];

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsRecommendationService: JobsRecommendationService,
    private readonly jobsMetricsService: JobsMetricsService,
  ) {}

  async getFilters() {
    const publishedWhere = { status: 'published' } satisfies Prisma.JobAnnouncementWhereInput;
    const [degrees, natures, recruitmentTypes] = await Promise.all([
      this.prisma.jobAnnouncement.findMany({ where: publishedWhere, select: { degreeRequirement: true }, distinct: ['degreeRequirement'] }),
      this.prisma.jobAnnouncement.findMany({ where: publishedWhere, select: { enterpriseNature: true }, distinct: ['enterpriseNature'] }),
      this.prisma.jobAnnouncement.findMany({ where: publishedWhere, select: { recruitmentType: true }, distinct: ['recruitmentType'] }),
    ]);

    const degreeOptions = this.uniqueFilterValues(degrees.map((item) => item.degreeRequirement));
    const enterpriseNatureOptions = this.uniqueFilterValues(natures.map((item) => item.enterpriseNature));
    const recruitmentTypeOptions = this.uniqueFilterValues(recruitmentTypes.map((item) => item.recruitmentType));

    return {
      degreeOptions,
      enterpriseNatureOptions,
      recruitmentTypeOptions,
      jobTypeOptions: recruitmentTypeOptions,
    };
  }

  async getList(query: QueryJobsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = await this.buildListWhere(query);
    const includeTracking = query.userId
      ? { trackings: { where: { userId: query.userId }, take: 1 } }
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
      list: list.map((job) => buildLegacyJobCard(job as JobAnnouncementViewPayload)),
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

  async recordClick(userId: string, id: string, dto: JobsClickDto) {
    await this.ensurePublishedJob(id);
    await this.jobsMetricsService.recordAccessClick(id, dto.actionType);
    invalidateJobsRecommendationCacheByUserId(userId);
    return { recorded: true };
  }

  async getDetail(id: string, userId?: string) {
    const job = await this.prisma.jobAnnouncement.findUnique({
      where: { id },
      include: userId ? { trackings: { where: { userId }, take: 1 } } : undefined,
    });

    if (!job || job.status !== 'published') {
      throw new NotFoundException('岗位不存在');
    }

    return buildLegacyJobCard(job as JobAnnouncementViewPayload);
  }

  async deliver(userId: string, id: string) {
    const job = await this.ensurePublishedJob(id);
    await assertUserHasMemberPermission(this.prisma, userId, 'jobs:deliver:use', '标准会员及以上可使用立即投递');

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

      const deliveryMethod = resolveJobDeliveryMethod(job.deliveryUrl);
      return {
        action: deliveryMethod === 'email' ? 'copy_email' : 'open_link',
        deliveryType: deliveryMethod,
        deliveryUrl: job.deliveryUrl,
        recruitmentType: deliveryMethod,
        recruitmentLink: job.deliveryUrl,
        progressStatus: '已投递',
      };
    });

    invalidateJobsRecommendationCacheByUserId(userId);
    return result;
  }

  async updateProgress(userId: string, id: string, dto: UpdateProgressDto) {
    await this.ensurePublishedJob(id);
    await assertUserHasMemberPermission(this.prisma, userId, 'jobs:progress:update', '超级会员可标记求职进度');

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

  async getReferral(userId: string, id: string) {
    const job = await this.ensurePublishedJob(id);
    await assertUserHasMemberPermission(this.prisma, userId, 'jobs:referral:view', '超级会员可查看内推信息');
    await this.jobsMetricsService.recordAccessClick(id, 'view_referral');

    return {
      hasReferral: Boolean(job.referralCode),
      referralCode: job.referralCode,
      contactHint: job.referralCode ? '复制内推码后前往企业投递入口使用' : '当前岗位暂无内推资源',
    };
  }

  private async buildListWhere(query: QueryJobsDto): Promise<Prisma.JobAnnouncementWhereInput> {
    const where = await this.buildBaseWhere(query);

    if (query.userId && query.progressStatus && query.progressStatus !== '全部') {
      where.trackings = {
        some: {
          userId: query.userId,
          progressStatus: query.progressStatus,
        },
      };
    }

    return where;
  }

  private async buildBaseWhere(query: QueryJobsDto): Promise<Prisma.JobAnnouncementWhereInput> {
    const and: Prisma.JobAnnouncementWhereInput[] = [{ status: 'published' }];

    const generalKeywordFilter = this.buildGeneralKeywordFilter(query.keyword);
    if (generalKeywordFilter) {
      and.push(generalKeywordFilter);
    }

    const cityKeywordFilter = this.buildSingleFieldContainsFilter('workLocation', query.cityKeyword);
    if (cityKeywordFilter) {
      and.push(cityKeywordFilter);
    }

    const companyKeywordFilter = this.buildMultiFieldContainsFilter(['companyFullName', 'announcementTitle'], query.companyName);
    if (companyKeywordFilter) {
      and.push(companyKeywordFilter);
    }

    const positionKeywordFilter = this.buildMultiFieldContainsFilter(['jobName', 'jobCategory', 'announcementTitle'], query.positionName);
    if (positionKeywordFilter) {
      and.push(positionKeywordFilter);
    }

    const majorKeywordFilter = this.buildMultiFieldContainsFilter(['jobCategory', 'announcementTitle', 'industry', 'graduationSession'], query.major);
    if (majorKeywordFilter) {
      and.push(majorKeywordFilter);
    }

    const degreeValues = this.mergeFilterValues(query.degreeRequirement, query.degree);
    const degreeFilter = this.buildMultiContainsFieldFilter('degreeRequirement', degreeValues);
    if (degreeFilter) {
      and.push(degreeFilter);
    }

    const enterpriseNatureFilter = this.buildMultiContainsFieldFilter('enterpriseNature', query.enterpriseNature);
    if (enterpriseNatureFilter) {
      and.push(enterpriseNatureFilter);
    }

    const recruitmentTypeFilter = this.buildMultiContainsFieldFilter('recruitmentType', this.mergeFilterValues(query.recruitmentType, query.jobType));
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

  private buildGeneralKeywordFilter(keyword?: string) {
    const normalizedKeyword = keyword?.trim();
    if (!normalizedKeyword) {
      return null;
    }

    return {
      OR: GENERAL_SEARCH_FIELDS.map((field) => ({ [field]: { contains: normalizedKeyword } } as Prisma.JobAnnouncementWhereInput)),
    } satisfies Prisma.JobAnnouncementWhereInput;
  }

  private buildSingleFieldContainsFilter(field: GeneralSearchField, keyword?: string) {
    const normalizedKeyword = keyword?.trim();
    if (!normalizedKeyword) {
      return null;
    }

    return { [field]: { contains: normalizedKeyword } } as Prisma.JobAnnouncementWhereInput;
  }

  private buildMultiFieldContainsFilter(fields: GeneralSearchField[], keyword?: string) {
    const normalizedKeyword = keyword?.trim();
    if (!normalizedKeyword) {
      return null;
    }

    return {
      OR: fields.map((field) => ({ [field]: { contains: normalizedKeyword } } as Prisma.JobAnnouncementWhereInput)),
    } satisfies Prisma.JobAnnouncementWhereInput;
  }

  private buildMultiContainsFieldFilter(field: GeneralSearchField, values?: string[]) {
    const normalizedValues = this.uniqueFilterValues(values ?? []);
    if (!normalizedValues.length) {
      return null;
    }

    const conditions = normalizedValues.map((value) => ({ [field]: { contains: value } } as Prisma.JobAnnouncementWhereInput));
    return conditions.length === 1 ? conditions[0] : { OR: conditions };
  }

  private mergeFilterValues(...groups: Array<string[] | undefined>) {
    return groups.flatMap((group) => group ?? []);
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
