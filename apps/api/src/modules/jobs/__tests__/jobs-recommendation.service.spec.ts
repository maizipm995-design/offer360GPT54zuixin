import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JobsRecommendationService } from '../jobs-recommendation.service';
import { clearAllJobsRecommendationCache } from '../jobs-recommendation-cache';
import type {
  LocationDictionarySnapshot,
  LocationPreferenceKeyword,
  NormalizedPreferenceKeyword,
} from '../jobs-normalization.types';

vi.mock('../../../common/utils/member-access', () => ({
  assertUserHasMemberPermission: vi.fn().mockResolvedValue({ memberRoleCode: 'SUPER_MEMBER' }),
}));

const locationDictionary: LocationDictionarySnapshot = {
  aliasEntries: [
    { canonical: '山东', aliases: ['山东', '山东省', '鲁'] },
    { canonical: '济南', aliases: ['济南', '济南市'] },
    { canonical: '青岛', aliases: ['青岛', '青岛市'] },
  ],
  cityParentProvinceMap: {
    济南: '山东',
    青岛: '山东',
  },
};

const jinanPreference: LocationPreferenceKeyword = {
  raw: '济南',
  canonical: '济南',
  aliases: ['济南', '济南市'],
  kind: 'city',
  parentProvince: '山东',
  parentProvinceAliases: ['山东', '山东省'],
  siblingCityKeywords: ['青岛'],
};

function createNormalizedKeyword(raw: string, canonical: string, aliases: string[], searchKeywords = aliases): NormalizedPreferenceKeyword {
  return {
    raw,
    canonical,
    aliases,
    aliasNormalized: aliases.map((item) => normalizeTextForMatch(item)),
    searchKeywords,
    searchNormalized: searchKeywords.map((item) => normalizeTextForMatch(item)),
    matched: true,
  };
}

function normalizeTextForMatch(value?: string | null) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[·•（）()【】\[\]，,、；;｜|/]/g, '');
}

type MockJob = {
  id: string;
  companyFullName: string;
  enterpriseNature: string;
  degreeRequirement: string;
  workLocation: string;
  jobName: string;
  jobCategory: string;
  recruitmentType: string;
  deadlineAt: string;
  announcementUrl: string;
  deliveryUrl: string;
  graduationSession: string;
  referralCode: string | null;
  announcementTitle: string;
  industry: string;
  entryDate: string;
  accessClickCount: number;
  deliveryMarkCount: number;
  lastAccessAt: Date | null;
  lastDeliveryMarkAt: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  trackings: Array<{ progressStatus: string; userId?: string }>;
};

function createJob(overrides: Partial<MockJob> = {}): MockJob {
  return {
    id: 'job-1',
    companyFullName: '山东能源集团有限公司',
    enterpriseNature: '国企',
    degreeRequirement: '本科',
    workLocation: '济南',
    jobName: '行政助理',
    jobCategory: '职能类',
    recruitmentType: '校招',
    deadlineAt: '2099-12-31',
    announcementUrl: 'https://example.com/job-1',
    deliveryUrl: 'https://example.com/deliver/job-1',
    graduationSession: '2026届',
    referralCode: null,
    announcementTitle: '山东能源集团校园招聘公告',
    industry: '能源',
    entryDate: '2026-04-28',
    accessClickCount: 0,
    deliveryMarkCount: 0,
    lastAccessAt: null,
    lastDeliveryMarkAt: null,
    status: 'published',
    createdAt: new Date('2026-04-20T00:00:00Z'),
    updatedAt: new Date('2026-04-28T00:00:00Z'),
    trackings: [],
    ...overrides,
  };
}

function matchesStringContains(source: string | null | undefined, keyword: string) {
  return String(source ?? '').toLowerCase().includes(keyword.toLowerCase());
}

function matchesWhere(job: MockJob, where?: Record<string, any>): boolean {
  if (!where) {
    return true;
  }

  if (where.AND) {
    const conditions = Array.isArray(where.AND) ? where.AND : [where.AND];
    if (!conditions.every((condition) => matchesWhere(job, condition))) {
      return false;
    }
  }

  if (where.OR) {
    const conditions = Array.isArray(where.OR) ? where.OR : [where.OR];
    if (!conditions.some((condition) => matchesWhere(job, condition))) {
      return false;
    }
  }

  if (where.NOT) {
    const conditions = Array.isArray(where.NOT) ? where.NOT : [where.NOT];
    if (conditions.some((condition) => matchesWhere(job, condition))) {
      return false;
    }
  }

  if (where.id?.in && !where.id.in.includes(job.id)) {
    return false;
  }

  if (where.status && job.status !== where.status) {
    return false;
  }

  if (where.updatedAt?.gte instanceof Date && job.updatedAt < where.updatedAt.gte) {
    return false;
  }

  if (where.enterpriseNature?.in && !where.enterpriseNature.in.includes(job.enterpriseNature)) {
    return false;
  }

  if (typeof where.enterpriseNature === 'string' && job.enterpriseNature !== where.enterpriseNature) {
    return false;
  }

  if (where.workLocation?.contains && !matchesStringContains(job.workLocation, where.workLocation.contains)) {
    return false;
  }

  if (where.companyFullName?.contains && !matchesStringContains(job.companyFullName, where.companyFullName.contains)) {
    return false;
  }

  if (where.jobName?.contains && !matchesStringContains(job.jobName, where.jobName.contains)) {
    return false;
  }

  if (where.jobCategory?.contains && !matchesStringContains(job.jobCategory, where.jobCategory.contains)) {
    return false;
  }

  if (where.announcementTitle?.contains && !matchesStringContains(job.announcementTitle, where.announcementTitle.contains)) {
    return false;
  }

  if (where.industry?.contains && !matchesStringContains(job.industry, where.industry.contains)) {
    return false;
  }

  if (where.degreeRequirement && typeof where.degreeRequirement === 'string' && job.degreeRequirement !== where.degreeRequirement) {
    return false;
  }

  return true;
}

function sortJobs(items: MockJob[], orderBy?: Array<Record<string, 'asc' | 'desc'>> | Record<string, 'asc' | 'desc'>) {
  const clauses = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
  return [...items].sort((left, right) => {
    for (const clause of clauses) {
      const [field, direction] = Object.entries(clause)[0] ?? [];
      if (!field || !direction) {
        continue;
      }

      const leftValue = left[field as keyof MockJob];
      const rightValue = right[field as keyof MockJob];
      const leftComparable = leftValue instanceof Date ? leftValue.getTime() : Number(leftValue ?? 0);
      const rightComparable = rightValue instanceof Date ? rightValue.getTime() : Number(rightValue ?? 0);
      if (leftComparable === rightComparable) {
        continue;
      }

      return direction === 'desc' ? rightComparable - leftComparable : leftComparable - rightComparable;
    }

    return 0;
  });
}

function createNormalizationServiceMock(options?: {
  locationPreferences?: LocationPreferenceKeyword[];
  companyPreferences?: NormalizedPreferenceKeyword[];
  jobPreferences?: NormalizedPreferenceKeyword[];
  normalizedDegree?: NormalizedPreferenceKeyword | null;
  normalizedMajor?: NormalizedPreferenceKeyword | null;
}) {
  return {
    normalizePreferences: vi.fn().mockImplementation(async (domain: string) => {
      if (domain === 'COMPANY') {
        return options?.companyPreferences ?? [];
      }
      if (domain === 'JOB_TITLE') {
        return options?.jobPreferences ?? [];
      }
      return [];
    }),
    normalizeLocationPreferences: vi.fn().mockResolvedValue(options?.locationPreferences ?? [jinanPreference]),
    getLocationDictionary: vi.fn().mockResolvedValue(locationDictionary),
    normalizeSingle: vi.fn().mockImplementation(async (domain: string) => {
      if (domain === 'DEGREE') {
        return options?.normalizedDegree ?? null;
      }
      if (domain === 'MAJOR') {
        return options?.normalizedMajor ?? null;
      }
      return null;
    }),
    normalizeTextForMatch: vi.fn().mockImplementation(normalizeTextForMatch),
  };
}

function createPrismaMock(options: {
  jobs: MockJob[];
  profile?: { degree?: string | null; major?: string | null } | null;
  preference?: {
    intentionCity?: string[];
    intentionJob?: string[];
    intentionCompany?: string[];
  } | null;
}) {
  const findMany = vi.fn().mockImplementation(async (args: { where?: Record<string, any>; select?: { id: true }; orderBy?: any; take?: number }) => {
    const matchedJobs = sortJobs(
      options.jobs.filter((job) => matchesWhere(job, args.where)),
      args.orderBy,
    ).slice(0, args.take ?? options.jobs.length);

    if (args.select?.id) {
      return matchedJobs.map((job) => ({ id: job.id }));
    }

    return matchedJobs;
  });

  return {
    jobsRecommendationConfig: {
      findFirst: vi.fn().mockResolvedValue({
        id: 1,
        companyWeight: 35,
        jobWeight: 30,
        cityExactWeight: 20,
        cityParentWeight: 10,
        degreeWeight: 8,
        majorWeight: 8,
        fresh3DaysWeight: 6,
        fresh7DaysWeight: 3,
        stateOwnedFallbackWeight: 4,
        deliveredPenalty: -12,
        heatMax: 6,
        hotAccessThreshold: 50,
        hotDeliveryThreshold: 10,
        updatedAt: new Date('2026-04-28T00:00:00Z'),
      }),
      create: vi.fn(),
    },
    userProfile: {
      findUnique: vi.fn().mockResolvedValue(options.profile ?? null),
    },
    userJobPreferenceTag: {
      findUnique: vi.fn().mockResolvedValue({
        intentionCity: options.preference?.intentionCity ?? ['济南'],
        intentionJob: options.preference?.intentionJob ?? [],
        intentionCompany: options.preference?.intentionCompany ?? [],
      }),
    },
    jobAnnouncement: {
      findMany,
    },
  };
}

describe('JobsRecommendationService', () => {
  beforeEach(() => {
    clearAllJobsRecommendationCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('岗位仅写父级省份时只记为父级弱命中，不记为城市精确命中', async () => {
    const prisma = createPrismaMock({
      jobs: [createJob({ workLocation: '山东省' })],
    });
    const normalizationService = createNormalizationServiceMock();
    const service = new JobsRecommendationService(prisma as never, normalizationService as never);

    const result = await service.getRecommendedList('user-1', { page: 1, limit: 20 });

    expect(result.list[0]?.recommendReasons).toContain('匹配城市父级范围：济南');
    expect(result.list[0]?.recommendReasons?.some((item) => item.includes('匹配意向城市'))).toBe(false);
  });

  it('同省其他城市公告不会获得地点命中分', async () => {
    const prisma = createPrismaMock({
      jobs: [createJob({ workLocation: '青岛,山东' })],
    });
    const normalizationService = createNormalizationServiceMock();
    const service = new JobsRecommendationService(prisma as never, normalizationService as never);

    const result = await service.getRecommendedList('user-1', { page: 1, limit: 20 });

    expect(result.list[0]?.recommendReasons?.some((item) => item.includes('匹配意向城市') || item.includes('匹配城市父级范围'))).toBe(false);
  });

  it('岗位 企业 学历 专业存在标准化别名关系时仍能组合命中', async () => {
    const companyPreference = createNormalizedKeyword('中烟', '中国烟草', ['中国烟草', '中烟']);
    const jobPreference = createNormalizedKeyword('研发', '研发', ['研发', '研发工程师']);
    const degreePreference = createNormalizedKeyword('大学本科', '本科', ['本科', '大学本科']);
    const majorPreference = createNormalizedKeyword('计算机科学', '计算机', ['计算机', '计算机科学', '计算机科学与技术']);

    const prisma = createPrismaMock({
      jobs: [createJob({
        companyFullName: '山东中烟工业有限责任公司',
        jobName: '研发工程师',
        jobCategory: '研发类',
        degreeRequirement: '大学本科及以上',
        announcementTitle: '2026届校园招聘（计算机科学与技术相关专业优先）',
        industry: '烟草',
      })],
      profile: {
        degree: '大学本科',
        major: '计算机科学',
      },
      preference: {
        intentionCity: [],
        intentionJob: ['研发'],
        intentionCompany: ['中烟'],
      },
    });
    const normalizationService = createNormalizationServiceMock({
      locationPreferences: [],
      companyPreferences: [companyPreference],
      jobPreferences: [jobPreference],
      normalizedDegree: degreePreference,
      normalizedMajor: majorPreference,
    });
    const service = new JobsRecommendationService(prisma as never, normalizationService as never);

    const result = await service.getRecommendedList('user-1', { page: 1, limit: 20 });
    const reasons = result.list[0]?.recommendReasons ?? [];
    const hitDimensions = result.list[0]?.recommendMeta?.hitDimensions ?? [];

    expect(reasons).toContain('匹配意向公司：中国烟草');
    expect(reasons).toContain('匹配目标岗位：研发');
    expect(hitDimensions).toEqual(expect.arrayContaining(['company', 'job', 'degree', 'major']));
  });

  it('标准化改造后 超过 90 天未更新岗位仍不能进入候选', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-28T00:00:00Z'));

    const prisma = createPrismaMock({
      jobs: [createJob({
        id: 'job-old',
        companyFullName: '山东中烟工业有限责任公司',
        jobName: '软件开发工程师',
        updatedAt: new Date('2025-12-01T00:00:00Z'),
        announcementTitle: '超期旧岗位',
      })],
      profile: {
        degree: '大学本科',
        major: '计算机科学',
      },
      preference: {
        intentionCity: [],
        intentionJob: ['研发'],
        intentionCompany: ['中烟'],
      },
    });
    const normalizationService = createNormalizationServiceMock({
      locationPreferences: [],
      companyPreferences: [createNormalizedKeyword('中烟', '中国烟草', ['中国烟草', '中烟'])],
      jobPreferences: [createNormalizedKeyword('研发', '研发', ['研发', '研发工程师'])],
    });
    const service = new JobsRecommendationService(prisma as never, normalizationService as never);

    const result = await service.getRecommendedList('user-1', { page: 1, limit: 20 });

    expect(result.list).toHaveLength(0);
    expect(prisma.jobAnnouncement.findMany).toHaveBeenCalled();
    const firstSelectCall = prisma.jobAnnouncement.findMany.mock.calls.find(([args]: [{ select?: { id: true } }]) => Boolean(args.select?.id));
    expect(firstSelectCall?.[0]?.where?.AND?.[0]?.updatedAt?.gte).toEqual(new Date('2026-01-28T00:00:00Z'));
  });

  it('exact alias 归一后 推荐候选召回也只使用安全召回关键词', async () => {
    const prisma = createPrismaMock({
      jobs: [createJob({
        jobName: '行政助理',
        jobCategory: '职能类',
        announcementTitle: '综合行政岗位招聘',
      })],
      profile: null,
      preference: {
        intentionCity: [],
        intentionJob: ['行政'],
        intentionCompany: [],
      },
    });
    const normalizationService = createNormalizationServiceMock({
      locationPreferences: [],
      companyPreferences: [],
      jobPreferences: [createNormalizedKeyword('行政', '人事 / 行政', ['人事 / 行政', '行政'], ['人事 / 行政'])],
      normalizedDegree: null,
      normalizedMajor: null,
    });
    const service = new JobsRecommendationService(prisma as never, normalizationService as never);

    await service.getRecommendedList('user-1', { page: 1, limit: 20 });

    const firstSelectCall = prisma.jobAnnouncement.findMany.mock.calls.find(([args]: [{ select?: { id: true } }]) => Boolean(args.select?.id));
    const recallWhere = firstSelectCall?.[0]?.where;
    const recallText = JSON.stringify(recallWhere);

    expect(recallText).toContain('人事 / 行政');
    expect(recallText).not.toContain('"contains":"行政"');
  });

  it('推荐过滤与专业打分会读取岗位分类中的专业信息', async () => {
    const companyPreference = createNormalizedKeyword('中烟', '中国烟草', ['中国烟草', '中烟']);
    const jobPreference = createNormalizedKeyword('研发', '研发', ['研发', '研发工程师']);
    const majorPreference = createNormalizedKeyword('计算机科学与技术', '计算机', ['计算机', '计算机科学与技术']);

    const prisma = createPrismaMock({
      jobs: [createJob({
        companyFullName: '山东中烟工业有限责任公司',
        jobName: '研发工程师',
        jobCategory: '计算机相关专业优先',
        announcementTitle: '校园招聘公告',
        industry: '烟草',
      })],
      profile: {
        degree: null,
        major: '计算机科学与技术',
      },
      preference: {
        intentionCity: [],
        intentionJob: ['研发'],
        intentionCompany: ['中烟'],
      },
    });
    const normalizationService = createNormalizationServiceMock({
      locationPreferences: [],
      companyPreferences: [companyPreference],
      jobPreferences: [jobPreference],
      normalizedDegree: null,
      normalizedMajor: majorPreference,
    });
    const service = new JobsRecommendationService(prisma as never, normalizationService as never);

    const result = await service.getRecommendedList('user-1', { page: 1, limit: 20, major: '计算机科学与技术' });
    const hitDimensions = result.list[0]?.recommendMeta?.hitDimensions ?? [];

    expect(result.list).toHaveLength(1);
    expect(hitDimensions).toContain('major');
  });
});
