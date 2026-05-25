import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { assertUserHasMemberPermission } from '../../common/utils/member-access';
import { PrismaService } from '../../prisma.service';
import { QueryJobsDto } from './dto/query-jobs.dto';
import {
  JOBS_RECOMMENDATION_COMBINATION_BATCH_SIZE,
  JOBS_RECOMMENDATION_FALLBACK_CANDIDATE_LIMIT,
  JOBS_RECOMMENDATION_FALLBACK_ENTERPRISE_NATURES,
  JOBS_RECOMMENDATION_FALLBACK_FRESH_DAYS,
  JOBS_RECOMMENDATION_MAX_CANDIDATES,
  JOBS_RECOMMENDATION_MAX_PREFERENCE_KEYWORDS,
  JOBS_RECOMMENDATION_ONE_DIMENSION_COMBINATION_LIMIT,
  JOBS_RECOMMENDATION_PARENT_LOCATION_LOOKBACK_DAYS,
  JOBS_RECOMMENDATION_PER_COMBINATION_TAKE,
  JOBS_RECOMMENDATION_PRIMARY_CANDIDATE_LIMIT,
  JOBS_RECOMMENDATION_REASON_LIMIT,
  JOBS_RECOMMENDATION_THREE_DIMENSION_COMBINATION_LIMIT,
  JOBS_RECOMMENDATION_TWO_DIMENSION_COMBINATION_LIMIT,
  JOBS_RECOMMENDATION_VERSION,
} from './jobs-recommendation.constants';
import { ensureJobsRecommendationConfig, type JobsRecommendationConfigSnapshot } from './jobs-recommendation-config';
import { getJobsRecommendationCache, setJobsRecommendationCache } from './jobs-recommendation-cache';
import { buildLocationRecallClauses, matchLocationPreferences } from './jobs-recommendation-location';
import { JobsNormalizationService } from './jobs-normalization.service';
import type {
  LocationDictionarySnapshot,
  LocationPreferenceKeyword,
  NormalizedPreferenceKeyword,
} from './jobs-normalization.types';
import type {
  RecommendationCandidate,
  RecommendationListMeta,
  RecommendationMatchType,
  RecommendationReasonItem,
  RecommendationScoreResult,
} from './jobs-recommendation.types';
import {
  buildJobKeywordText,
  buildJobSupplementText,
  buildLegacyJobCard,
  resolveValidAnnouncementUrl,
  resolveValidDeliveryTarget,
} from './job-announcement-view';
import { isWithinDays, isWithinHours, parseJsonArray, subDays } from './jobs.utils';

type RecommendedJobPayload = Prisma.JobAnnouncementGetPayload<{ include: { trackings: true } }>;

const GENERAL_SEARCH_FIELDS = [
  'companyFullName',
  'enterpriseNature',
  'degreeRequirement',
  'workLocation',
  'jobName',
  'majorRequirement',
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

type RecommendedListResult = {
  list: ReturnType<JobsRecommendationService['toRecommendedJobCard']>[];
  pagination: { page: number; limit: number; total: number; hasMore: boolean };
  recommendedFeed?: RecommendationListMeta;
};

@Injectable()
export class JobsRecommendationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly normalizationService: JobsNormalizationService,
  ) {}

  async getRecommendedList(userId: string, query: QueryJobsDto): Promise<RecommendedListResult> {
    const access = await assertUserHasMemberPermission(this.prisma, userId, 'jobs:recommend:view', '专属推荐仅对超级会员开放，请先开通会员');
    const recommendationConfig = await ensureJobsRecommendationConfig(this.prisma);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const cacheKey = this.buildCacheKey(userId, access.memberRoleCode, recommendationConfig.updatedAt, page, limit, query);
    const cached = getJobsRecommendationCache<RecommendedListResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const now = new Date();
    const baseWhere = await this.buildBaseWhere(query, now);
    const [profile, preference] = await Promise.all([
      this.prisma.userProfile.findUnique({ where: { userId } }),
      this.prisma.userJobPreferenceTag.findUnique({ where: { userId } }),
    ]);

    const preparedCompanyInput = this.preparePreferenceKeywords(parseJsonArray<string>(preference?.intentionCompany));
    const preparedJobInput = this.preparePreferenceKeywords(parseJsonArray<string>(preference?.intentionJob));
    const preparedLocationInput = this.preparePreferenceKeywords(parseJsonArray<string>(preference?.intentionCity));

    const [companyPreferences, jobPreferences, locationPreferences, locationDictionary, normalizedDegree, normalizedMajor] = await Promise.all([
      this.normalizationService.normalizePreferences('COMPANY', preparedCompanyInput),
      this.normalizationService.normalizePreferences('JOB_TITLE', preparedJobInput),
      this.normalizationService.normalizeLocationPreferences(preparedLocationInput),
      this.normalizationService.getLocationDictionary(),
      this.normalizationService.normalizeSingle('DEGREE', profile?.degree),
      this.normalizationService.normalizeSingle('MAJOR', profile?.major),
    ]);

    const hasPreferences = Boolean(companyPreferences.length || jobPreferences.length || locationPreferences.length);

    if (!hasPreferences) {
      const emptyResult = this.buildResult([], page, limit, {
        stateCode: 'PREFERENCE_REQUIRED',
        hasPreferences: false,
        stateMessage: '完善求职意向后，即可查看专属推荐',
        summaryText: '请先在个人中心填写意向城市、意向岗位或意向公司。',
      });
      setJobsRecommendationCache(userId, cacheKey, emptyResult);
      return emptyResult;
    }

    const candidateMap = await this.recallCandidates(baseWhere, {
      companyPreferences,
      jobPreferences,
      locationPreferences,
    });

    const recommendedFeed: RecommendationListMeta = {
      stateCode: 'DEFAULT',
      hasPreferences: true,
      summaryText: this.buildRecommendationSummary(companyPreferences, jobPreferences, locationPreferences),
    };

    if (!candidateMap.size) {
      const fallbackIds = await this.recallFallbackCandidateIds(baseWhere, now);
      this.mergeCandidates(candidateMap, fallbackIds, 0, 'FALLBACK');
      recommendedFeed.stateCode = 'NO_MATCHED_RESULT';
      recommendedFeed.stateMessage = '暂无匹配岗位，可调整意向条件后重试';
      recommendedFeed.summaryText = '已为你展示近期热门岗位，方便继续浏览与投递。';
      recommendedFeed.fallbackMode = 'HOT_JOBS';
    }

    if (!candidateMap.size) {
      const emptyResult = this.buildResult([], page, limit, recommendedFeed);
      setJobsRecommendationCache(userId, cacheKey, emptyResult);
      return emptyResult;
    }

    const candidateJobs = await this.prisma.jobAnnouncement.findMany({
      where: { id: { in: Array.from(candidateMap.keys()) } },
      include: {
        trackings: {
          where: { userId },
          take: 1,
        },
      },
    });

    const filteredCandidateJobs = query.progressStatus && query.progressStatus !== '全部'
      ? candidateJobs.filter((job) => (job.trackings?.[0]?.progressStatus ?? '未标记') === query.progressStatus)
      : candidateJobs;

    const scoredJobs = filteredCandidateJobs
      .map((job) => {
        const candidate = candidateMap.get(job.id);
        return {
          job,
          candidate,
          scoreResult: this.scoreJob(job, {
            companyPreferences,
            jobPreferences,
            locationPreferences,
            locationDictionary,
            degree: normalizedDegree,
            major: normalizedMajor,
            now,
            config: recommendationConfig,
            candidate,
          }),
        };
      })
      .sort((left, right) => {
        if (right.scoreResult.score !== left.scoreResult.score) {
          return right.scoreResult.score - left.scoreResult.score;
        }

        const rightTier = right.candidate?.matchTier ?? 0;
        const leftTier = left.candidate?.matchTier ?? 0;
        if (rightTier !== leftTier) {
          return rightTier - leftTier;
        }

        const heatDiff = ((right.job.deliveryMarkCount ?? 0) + (right.job.accessClickCount ?? 0))
          - ((left.job.deliveryMarkCount ?? 0) + (left.job.accessClickCount ?? 0));
        if (heatDiff !== 0) {
          return heatDiff;
        }

        const updatedDiff = right.job.updatedAt.getTime() - left.job.updatedAt.getTime();
        if (updatedDiff !== 0) {
          return updatedDiff;
        }

        return (left.candidate?.sourceOrder ?? Number.MAX_SAFE_INTEGER) - (right.candidate?.sourceOrder ?? Number.MAX_SAFE_INTEGER);
      });

    const pageItems = scoredJobs
      .slice((page - 1) * limit, page * limit)
      .map(({ job, scoreResult }) => this.toRecommendedJobCard(job, scoreResult, access.permissionKeys));

    const result = this.buildResult(pageItems, page, limit, recommendedFeed, scoredJobs.length);
    setJobsRecommendationCache(userId, cacheKey, result);
    return result;
  }

  private async recallCandidates(
    baseWhere: Prisma.JobAnnouncementWhereInput,
    context: {
      companyPreferences: NormalizedPreferenceKeyword[];
      jobPreferences: NormalizedPreferenceKeyword[];
      locationPreferences: LocationPreferenceKeyword[];
    },
  ) {
    const candidateMap = new Map<string, RecommendationCandidate>();
    const hasCompany = context.companyPreferences.length > 0;
    const hasJob = context.jobPreferences.length > 0;
    const hasLocation = context.locationPreferences.length > 0;
    const dimensionCount = [hasCompany, hasJob, hasLocation].filter(Boolean).length;

    if (dimensionCount === 3) {
      await this.runRecallStage(
        baseWhere,
        this.buildThreeDimensionConditions(context.locationPreferences, context.jobPreferences, context.companyPreferences),
        candidateMap,
        3,
        'CITY_JOB_COMPANY',
      );
      await this.runRecallStage(
        baseWhere,
        this.buildLocationCompanyConditions(context.locationPreferences, context.companyPreferences),
        candidateMap,
        2,
        'CITY_COMPANY',
      );
      await this.runRecallStage(
        baseWhere,
        this.buildLocationJobConditions(context.locationPreferences, context.jobPreferences),
        candidateMap,
        2,
        'CITY_JOB',
      );
      return candidateMap;
    }

    if (dimensionCount === 2) {
      if (hasLocation && hasCompany) {
        await this.runRecallStage(
          baseWhere,
          this.buildLocationCompanyConditions(context.locationPreferences, context.companyPreferences),
          candidateMap,
          2,
          'CITY_COMPANY',
        );
      }
      if (hasLocation && hasJob) {
        await this.runRecallStage(
          baseWhere,
          this.buildLocationJobConditions(context.locationPreferences, context.jobPreferences),
          candidateMap,
          2,
          'CITY_JOB',
        );
      }
      if (hasJob && hasCompany) {
        await this.runRecallStage(
          baseWhere,
          this.buildJobCompanyConditions(context.jobPreferences, context.companyPreferences),
          candidateMap,
          2,
          'JOB_COMPANY',
        );
      }
      return candidateMap;
    }

    if (hasLocation) {
      await this.runRecallStage(baseWhere, this.buildLocationOnlyConditions(context.locationPreferences), candidateMap, 1, 'CITY_ONLY');
    }
    if (hasJob) {
      await this.runRecallStage(baseWhere, this.buildJobOnlyConditions(context.jobPreferences), candidateMap, 1, 'JOB_ONLY');
    }
    if (hasCompany) {
      await this.runRecallStage(baseWhere, this.buildCompanyOnlyConditions(context.companyPreferences), candidateMap, 1, 'COMPANY_ONLY');
    }

    return candidateMap;
  }

  private async runRecallStage(
    baseWhere: Prisma.JobAnnouncementWhereInput,
    conditions: Prisma.JobAnnouncementWhereInput[],
    candidateMap: Map<string, RecommendationCandidate>,
    matchTier: RecommendationCandidate['matchTier'],
    matchType: RecommendationMatchType,
  ) {
    if (!conditions.length || candidateMap.size >= JOBS_RECOMMENDATION_MAX_CANDIDATES) {
      return;
    }

    const batches = this.chunkArray(conditions, JOBS_RECOMMENDATION_COMBINATION_BATCH_SIZE);
    for (const batch of batches) {
      if (candidateMap.size >= JOBS_RECOMMENDATION_MAX_CANDIDATES) {
        break;
      }

      const take = Math.min(
        JOBS_RECOMMENDATION_PRIMARY_CANDIDATE_LIMIT,
        Math.max(batch.length * JOBS_RECOMMENDATION_PER_COMBINATION_TAKE, JOBS_RECOMMENDATION_PER_COMBINATION_TAKE),
      );
      const ids = await this.prisma.jobAnnouncement.findMany({
        where: {
          AND: [baseWhere, { OR: batch }],
        },
        select: { id: true },
        orderBy: { updatedAt: 'desc' },
        take,
      });
      this.mergeCandidates(candidateMap, ids.map((item) => item.id), matchTier, matchType);
    }
  }

  private async recallFallbackCandidateIds(baseWhere: Prisma.JobAnnouncementWhereInput, now: Date) {
    const fallbackUpdatedAt = this.resolveUpdatedAtFloor(baseWhere, subDays(now, JOBS_RECOMMENDATION_FALLBACK_FRESH_DAYS));
    const fallbackWhere = {
      ...baseWhere,
      updatedAt: { gte: fallbackUpdatedAt },
    } satisfies Prisma.JobAnnouncementWhereInput;

    const [stateOwnedFallback, genericFreshFallback, heatFallback] = await Promise.all([
      this.prisma.jobAnnouncement.findMany({
        where: {
          ...fallbackWhere,
          enterpriseNature: { in: [...JOBS_RECOMMENDATION_FALLBACK_ENTERPRISE_NATURES] },
        },
        select: { id: true },
        orderBy: [{ updatedAt: 'desc' }, { deliveryMarkCount: 'desc' }, { accessClickCount: 'desc' }],
        take: JOBS_RECOMMENDATION_FALLBACK_CANDIDATE_LIMIT,
      }),
      this.prisma.jobAnnouncement.findMany({
        where: fallbackWhere,
        select: { id: true },
        orderBy: [{ updatedAt: 'desc' }, { deliveryMarkCount: 'desc' }, { accessClickCount: 'desc' }],
        take: JOBS_RECOMMENDATION_FALLBACK_CANDIDATE_LIMIT,
      }),
      this.prisma.jobAnnouncement.findMany({
        where: baseWhere,
        select: { id: true },
        orderBy: [{ deliveryMarkCount: 'desc' }, { accessClickCount: 'desc' }, { updatedAt: 'desc' }],
        take: JOBS_RECOMMENDATION_FALLBACK_CANDIDATE_LIMIT,
      }),
    ]);

    return [stateOwnedFallback, genericFreshFallback, heatFallback].flatMap((items) => items.map((item) => item.id));
  }

  private buildThreeDimensionConditions(
    locations: LocationPreferenceKeyword[],
    jobs: NormalizedPreferenceKeyword[],
    companies: NormalizedPreferenceKeyword[],
  ): Prisma.JobAnnouncementWhereInput[] {
    const conditions: Prisma.JobAnnouncementWhereInput[] = [];

    for (const location of locations) {
      for (const job of jobs) {
        for (const company of companies) {
          conditions.push({
            AND: [
              this.buildLocationWhere(location),
              this.buildJobWhere(job),
              this.buildCompanyWhere(company),
            ],
          });

          if (conditions.length >= JOBS_RECOMMENDATION_THREE_DIMENSION_COMBINATION_LIMIT) {
            return conditions;
          }
        }
      }
    }

    return conditions;
  }

  private buildLocationCompanyConditions(locations: LocationPreferenceKeyword[], companies: NormalizedPreferenceKeyword[]): Prisma.JobAnnouncementWhereInput[] {
    const conditions: Prisma.JobAnnouncementWhereInput[] = [];

    for (const location of locations) {
      for (const company of companies) {
        conditions.push({
          AND: [this.buildLocationWhere(location), this.buildCompanyWhere(company)],
        });

        if (conditions.length >= JOBS_RECOMMENDATION_TWO_DIMENSION_COMBINATION_LIMIT) {
          return conditions;
        }
      }
    }

    return conditions;
  }

  private buildLocationJobConditions(locations: LocationPreferenceKeyword[], jobs: NormalizedPreferenceKeyword[]): Prisma.JobAnnouncementWhereInput[] {
    const conditions: Prisma.JobAnnouncementWhereInput[] = [];

    for (const location of locations) {
      for (const job of jobs) {
        conditions.push({
          AND: [this.buildLocationWhere(location), this.buildJobWhere(job)],
        });

        if (conditions.length >= JOBS_RECOMMENDATION_TWO_DIMENSION_COMBINATION_LIMIT) {
          return conditions;
        }
      }
    }

    return conditions;
  }

  private buildJobCompanyConditions(jobs: NormalizedPreferenceKeyword[], companies: NormalizedPreferenceKeyword[]): Prisma.JobAnnouncementWhereInput[] {
    const conditions: Prisma.JobAnnouncementWhereInput[] = [];

    for (const job of jobs) {
      for (const company of companies) {
        conditions.push({
          AND: [this.buildJobWhere(job), this.buildCompanyWhere(company)],
        });

        if (conditions.length >= JOBS_RECOMMENDATION_TWO_DIMENSION_COMBINATION_LIMIT) {
          return conditions;
        }
      }
    }

    return conditions;
  }

  private buildLocationOnlyConditions(locations: LocationPreferenceKeyword[]) {
    return locations
      .slice(0, JOBS_RECOMMENDATION_ONE_DIMENSION_COMBINATION_LIMIT)
      .map((location) => this.buildLocationWhere(location));
  }

  private buildJobOnlyConditions(jobs: NormalizedPreferenceKeyword[]) {
    return jobs
      .slice(0, JOBS_RECOMMENDATION_ONE_DIMENSION_COMBINATION_LIMIT)
      .map((job) => this.buildJobWhere(job));
  }

  private buildCompanyOnlyConditions(companies: NormalizedPreferenceKeyword[]) {
    return companies
      .slice(0, JOBS_RECOMMENDATION_ONE_DIMENSION_COMBINATION_LIMIT)
      .map((company) => this.buildCompanyWhere(company));
  }

  private buildLocationWhere(preference: LocationPreferenceKeyword): Prisma.JobAnnouncementWhereInput {
    const clauses = buildLocationRecallClauses(preference);
    const exactConditions = clauses.exactKeywords.map((keyword) => ({ workLocation: { contains: keyword } }));

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

  private buildCompanyWhere(company: NormalizedPreferenceKeyword): Prisma.JobAnnouncementWhereInput {
    const keywords = Array.from(new Set(company.searchKeywords.map((item) => item.trim()).filter(Boolean)));
    return {
      OR: keywords.map((keyword) => ({ companyFullName: { contains: keyword } })),
    };
  }

  private buildJobWhere(job: NormalizedPreferenceKeyword): Prisma.JobAnnouncementWhereInput {
    const keywords = Array.from(new Set(job.searchKeywords.map((item) => item.trim()).filter(Boolean)));
    return {
      OR: keywords.flatMap((keyword) => [
        { jobName: { contains: keyword } },
        { announcementTitle: { contains: keyword } },
      ]),
    };
  }

  private mergeCandidates(
    candidateMap: Map<string, RecommendationCandidate>,
    ids: string[],
    matchTier: RecommendationCandidate['matchTier'],
    matchType: RecommendationMatchType,
  ) {
    ids.forEach((id) => {
      if (candidateMap.has(id) || candidateMap.size >= JOBS_RECOMMENDATION_MAX_CANDIDATES) {
        return;
      }

      candidateMap.set(id, {
        jobId: id,
        matchTier,
        matchType,
        sourceOrder: candidateMap.size,
      });
    });
  }

  private async buildBaseWhere(query: QueryJobsDto, now: Date): Promise<Prisma.JobAnnouncementWhereInput> {
    const and: Prisma.JobAnnouncementWhereInput[] = [{
      status: 'published',
      updatedAt: { gte: subDays(now, JOBS_RECOMMENDATION_PARENT_LOCATION_LOOKBACK_DAYS) },
    }];

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

    const positionKeywordFilter = this.buildMultiFieldContainsFilter(['jobName', 'announcementTitle'], query.positionName);
    if (positionKeywordFilter) {
      and.push(positionKeywordFilter);
    }

    const majorKeywordFilter = this.buildMultiFieldContainsFilter(['majorRequirement', 'announcementTitle', 'industry', 'graduationSession'], query.major);
    if (majorKeywordFilter) {
      and.push(majorKeywordFilter);
    }

    const degreeFilter = this.buildMultiContainsFieldFilter('degreeRequirement', this.mergeFilterValues(query.degreeRequirement, query.degree));
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
      and.push({
        updatedAt: {
          gte: subDays(now, Math.min(Math.max(...query.updatedWithinDays), JOBS_RECOMMENDATION_PARENT_LOCATION_LOOKBACK_DAYS)),
        },
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

  private scoreJob(
    job: RecommendedJobPayload,
    context: {
      companyPreferences: NormalizedPreferenceKeyword[];
      jobPreferences: NormalizedPreferenceKeyword[];
      locationPreferences: LocationPreferenceKeyword[];
      locationDictionary: LocationDictionarySnapshot;
      degree: NormalizedPreferenceKeyword | null;
      major: NormalizedPreferenceKeyword | null;
      now: Date;
      config: JobsRecommendationConfigSnapshot;
      candidate?: RecommendationCandidate;
    },
  ): RecommendationScoreResult {
    let score = 0;
    const reasons: RecommendationReasonItem[] = [];
    const companyText = this.normalizationService.normalizeTextForMatch(job.companyFullName);
    const positionText = this.normalizationService.normalizeTextForMatch(buildJobKeywordText(job));
    const supplementText = this.normalizationService.normalizeTextForMatch(buildJobSupplementText(job));
    const degreeRequirementText = this.normalizationService.normalizeTextForMatch(job.degreeRequirement || '');
    const tracking = job.trackings?.[0];

    const matchedCompany = context.companyPreferences.find((preference) => this.matchesNormalizedPreference(companyText, preference));
    if (matchedCompany) {
      score += context.config.companyWeight;
      reasons.push({
        label: `匹配意向公司：${matchedCompany.canonical}`,
        weight: context.config.companyWeight,
        dimension: 'company',
      });
    }

    const matchedJob = context.jobPreferences.find((preference) => this.matchesNormalizedPreference(positionText, preference));
    if (matchedJob) {
      score += context.config.jobWeight;
      reasons.push({
        label: `匹配目标岗位：${matchedJob.canonical}`,
        weight: context.config.jobWeight,
        dimension: 'job',
      });
    }

    const locationMatch = matchLocationPreferences(job.workLocation || '', context.locationPreferences, context.locationDictionary);
    if (locationMatch.exactMatches.length) {
      score += context.config.cityExactWeight;
      reasons.push({
        label: `匹配意向城市：${locationMatch.exactMatches[0]}`,
        weight: context.config.cityExactWeight,
        dimension: 'location',
      });
    } else if (locationMatch.parentMatches.length) {
      score += context.config.cityParentWeight;
      reasons.push({
        label: `匹配城市父级范围：${locationMatch.parentMatches[0]}`,
        weight: context.config.cityParentWeight,
        dimension: 'location',
      });
    }

    if (context.degree && this.matchesNormalizedPreference(degreeRequirementText, context.degree)) {
      score += context.config.degreeWeight;
      reasons.push({
        label: `匹配你的学历：${context.degree.canonical}`,
        weight: context.config.degreeWeight,
        dimension: 'degree',
      });
    }

    if (context.major && this.matchesNormalizedPreference(supplementText, context.major)) {
      score += context.config.majorWeight;
      reasons.push({
        label: `补充信息匹配：${context.major.canonical}`,
        weight: context.config.majorWeight,
        dimension: 'major',
      });
    }

    if (isWithinHours(job.updatedAt, 72)) {
      score += context.config.fresh3DaysWeight;
      reasons.push({
        label: '近 3 天发布',
        weight: context.config.fresh3DaysWeight,
        dimension: 'freshness',
      });
    } else if (isWithinDays(job.updatedAt, 7)) {
      score += context.config.fresh7DaysWeight;
      reasons.push({
        label: '近 7 天更新',
        weight: context.config.fresh7DaysWeight,
        dimension: 'freshness',
      });
    }

    const heatScore = Math.min(
      context.config.heatMax,
      Math.floor((job.deliveryMarkCount ?? 0) / Math.max(context.config.hotDeliveryThreshold, 1))
        + Math.floor((job.accessClickCount ?? 0) / Math.max(context.config.hotAccessThreshold, 1)),
    );
    if (heatScore > 0) {
      score += heatScore;
      reasons.push({
        label: '岗位热度较高',
        weight: heatScore,
        dimension: 'heat',
      });
    }

    if (context.candidate?.matchType === 'FALLBACK' && job.enterpriseNature && JOBS_RECOMMENDATION_FALLBACK_ENTERPRISE_NATURES.includes(job.enterpriseNature as (typeof JOBS_RECOMMENDATION_FALLBACK_ENTERPRISE_NATURES)[number])) {
      score += context.config.stateOwnedFallbackWeight;
      reasons.push({
        label: `平台精选：${job.enterpriseNature}`,
        weight: context.config.stateOwnedFallbackWeight,
        dimension: 'fallback',
      });
    }

    if (tracking?.progressStatus && tracking.progressStatus !== '未标记') {
      score += context.config.deliveredPenalty;
    }

    const sortedReasons = reasons.sort((left, right) => right.weight - left.weight);
    return {
      score,
      reasons: sortedReasons.slice(0, JOBS_RECOMMENDATION_REASON_LIMIT),
      meta: {
        hitDimensions: Array.from(new Set(sortedReasons.map((item) => item.dimension))),
        version: `${JOBS_RECOMMENDATION_VERSION}-${context.config.updatedAt.getTime()}`,
        matchTier: context.candidate?.matchTier,
        matchType: context.candidate?.matchType,
      },
    };
  }

  private toRecommendedJobCard(
    job: RecommendedJobPayload,
    scoreResult: RecommendationScoreResult,
    permissionKeys: string[],
  ) {
    const announcementUrl = resolveValidAnnouncementUrl(job.announcementUrl);
    const deliveryTarget = resolveValidDeliveryTarget(job.deliveryUrl);
    return buildLegacyJobCard(job, {
      recommendReasons: scoreResult.reasons.map((item) => item.label),
      recommendMeta: scoreResult.meta,
      access: {
        canViewAnnouncement: Boolean(announcementUrl) && permissionKeys.includes('jobs:detail:view'),
        canDeliver: Boolean(deliveryTarget) && permissionKeys.includes('jobs:deliver:use'),
      },
    });
  }

  private preparePreferenceKeywords(input: string[]) {
    const seen = new Set<string>();
    return input
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item) => {
        if (seen.has(item)) {
          return false;
        }
        seen.add(item);
        return true;
      })
      .slice(0, JOBS_RECOMMENDATION_MAX_PREFERENCE_KEYWORDS);
  }

  private matchesNormalizedPreference(normalizedText: string, preference: NormalizedPreferenceKeyword) {
    return preference.searchNormalized.some((keyword) => Boolean(keyword) && normalizedText.includes(keyword));
  }

  private buildRecommendationSummary(
    companyPreferences: NormalizedPreferenceKeyword[],
    jobPreferences: NormalizedPreferenceKeyword[],
    locationPreferences: LocationPreferenceKeyword[],
  ) {
    return '';
  }

  private resolveUpdatedAtFloor(baseWhere: Prisma.JobAnnouncementWhereInput, floor: Date) {
    const baseUpdatedAt = baseWhere.updatedAt;
    if (baseUpdatedAt && typeof baseUpdatedAt === 'object' && 'gte' in baseUpdatedAt && baseUpdatedAt.gte instanceof Date) {
      return baseUpdatedAt.gte > floor ? baseUpdatedAt.gte : floor;
    }
    return floor;
  }

  private buildResult(
    list: ReturnType<JobsRecommendationService['toRecommendedJobCard']>[],
    page: number,
    limit: number,
    recommendedFeed?: RecommendationListMeta,
    total = list.length,
  ): RecommendedListResult {
    return {
      list,
      pagination: {
        page,
        limit,
        total,
        hasMore: page * limit < total,
      },
      recommendedFeed,
    };
  }

  private chunkArray<T>(items: T[], size: number) {
    const result: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
      result.push(items.slice(index, index + size));
    }
    return result;
  }

  private buildCacheKey(userId: string, memberRoleCode: string, configUpdatedAt: Date, page: number, limit: number, query: QueryJobsDto) {
    const filters = {
      companyName: query.companyName || '',
      positionName: query.positionName || '',
      major: query.major || '',
      workLocation: query.workLocation || '',
      degree: query.degree || '',
      enterpriseNature: query.enterpriseNature || '',
      jobType: query.jobType || '',
      updatedWithinDays: query.updatedWithinDays || '',
      progressStatus: query.progressStatus || '',
    };
    return [
      'jobs-recommended',
      JOBS_RECOMMENDATION_VERSION,
      configUpdatedAt.getTime(),
      userId,
      memberRoleCode,
      page,
      limit,
      JSON.stringify(filters),
    ].join(':');
  }
}
