import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getUserMemberAccess } from '../../../common/utils/member-access';
import { JobsService } from '../jobs.service';

vi.mock('../../../common/utils/member-access', () => ({
  assertUserHasMemberPermission: vi.fn(),
  getUserMemberAccess: vi.fn(),
}));

type MockJob = {
  id: string;
  companyFullName: string;
  enterpriseNature: string;
  degreeRequirement: string;
  workLocation: string;
  jobName: string;
  majorRequirement: string;
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
    companyFullName: '上海互联网科技有限公司',
    enterpriseNature: '民企',
    degreeRequirement: '本科及以上',
    workLocation: '上海市浦东新区',
    jobName: '前端开发工程师',
    majorRequirement: '计算机类、软件工程相关专业',
    recruitmentType: '校招',
    deadlineAt: '2099-12-31',
    announcementUrl: 'https://campus.acme.cn/job-1',
    deliveryUrl: 'https://apply.acme.cn/deliver/job-1',
    graduationSession: '2026届',
    referralCode: null,
    announcementTitle: '上海互联网科技 2026 届校园招聘公告',
    industry: '互联网',
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
  if (!where) return true;

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

  if (where.status && job.status !== where.status) return false;
  if (where.updatedAt?.gte instanceof Date && job.updatedAt < where.updatedAt.gte) return false;

  if (where.workLocation?.contains && !matchesStringContains(job.workLocation, where.workLocation.contains)) return false;
  if (where.companyFullName?.contains && !matchesStringContains(job.companyFullName, where.companyFullName.contains)) return false;
  if (where.enterpriseNature?.contains && !matchesStringContains(job.enterpriseNature, where.enterpriseNature.contains)) return false;
  if (where.degreeRequirement?.contains && !matchesStringContains(job.degreeRequirement, where.degreeRequirement.contains)) return false;
  if (where.jobName?.contains && !matchesStringContains(job.jobName, where.jobName.contains)) return false;
  if (where.majorRequirement?.contains && !matchesStringContains(job.majorRequirement, where.majorRequirement.contains)) return false;
  if (where.recruitmentType?.contains && !matchesStringContains(job.recruitmentType, where.recruitmentType.contains)) return false;
  if (where.deadlineAt?.contains && !matchesStringContains(job.deadlineAt, where.deadlineAt.contains)) return false;
  if (where.announcementUrl?.contains && !matchesStringContains(job.announcementUrl, where.announcementUrl.contains)) return false;
  if (where.deliveryUrl?.contains && !matchesStringContains(job.deliveryUrl, where.deliveryUrl.contains)) return false;
  if (where.graduationSession?.contains && !matchesStringContains(job.graduationSession, where.graduationSession.contains)) return false;
  if (where.referralCode?.contains && !matchesStringContains(job.referralCode, where.referralCode.contains)) return false;
  if (where.announcementTitle?.contains && !matchesStringContains(job.announcementTitle, where.announcementTitle.contains)) return false;
  if (where.industry?.contains && !matchesStringContains(job.industry, where.industry.contains)) return false;
  if (where.entryDate?.contains && !matchesStringContains(job.entryDate, where.entryDate.contains)) return false;

  if (where.trackings?.some) {
    return job.trackings.some(
      (tracking) => tracking.userId === where.trackings.some.userId && tracking.progressStatus === where.trackings.some.progressStatus,
    );
  }

  return true;
}

function createPrismaMock(jobs: MockJob[]) {
  const findMany = vi.fn().mockImplementation(async (args: { where?: Record<string, any>; include?: any; orderBy?: any; skip?: number; take?: number }) => {
    const matched = jobs.filter((job) => matchesWhere(job, args.where));
    return matched.slice(args.skip ?? 0, (args.skip ?? 0) + (args.take ?? matched.length));
  });
  const count = vi.fn().mockImplementation(async (args: { where?: Record<string, any> }) => jobs.filter((job) => matchesWhere(job, args.where)).length);

  return {
    jobAnnouncement: { findMany, count },
    adminBootstrapConfig: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({ id: 1 }),
    },
    $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
    $transaction: vi.fn().mockImplementation((items: unknown[]) => Promise.all(items as Promise<unknown>[])),
  };
}

function createNormalizationMock(overrides: Partial<{
  normalizeLocationPreferences: ReturnType<typeof vi.fn>;
  expandSearchKeywords: ReturnType<typeof vi.fn>;
}> = {}) {
  return {
    normalizeLocationPreferences: overrides.normalizeLocationPreferences ?? vi.fn().mockResolvedValue([]),
    expandSearchKeywords: overrides.expandSearchKeywords ?? vi.fn().mockImplementation(async (_domain: string, keyword?: string) => keyword ? [keyword] : []),
  };
}

function createRedisMock() {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    zadd: vi.fn().mockResolvedValue(1),
    zremrangebyscore: vi.fn().mockResolvedValue(0),
    zcard: vi.fn().mockResolvedValue(1),
    zrange: vi.fn().mockResolvedValue([]),
    sadd: vi.fn().mockResolvedValue(1),
    smembers: vi.fn().mockResolvedValue([]),
  };
}

describe('JobsService fuzzy search filters', () => {
  beforeEach(() => {
    vi.mocked(getUserMemberAccess).mockResolvedValue({
      isMember: true,
      memberLevel: 'standard',
      memberLevelLabel: '标准会员',
      memberRoleCode: 'STANDARD_MEMBER',
      memberRoleName: '标准会员',
      permissionKeys: ['jobs:search:use', 'jobs:filter:use', 'jobs:detail:view', 'jobs:deliver:use'],
      membershipRemainingDays: 30,
    });
  });

  it('通用搜索会重点命中公司名、岗位名和专业需求，并覆盖单表文本字段模糊匹配', async () => {
    const prisma = createPrismaMock([
      createJob({ companyFullName: '深圳互联科技集团', jobName: '算法工程师', majorRequirement: '人工智能、计算机类相关专业' }),
      createJob({ id: 'job-2', companyFullName: '江苏电力集团', jobName: '行政专员', majorRequirement: '专业不限' }),
    ]);
    const service = new JobsService(prisma as never, {} as never, {} as never, createNormalizationMock() as never, createRedisMock() as never);

    const result = await service.getList({ keyword: '互联科技', page: 1, limit: 20 }, 'user-1');

    expect(result.list).toHaveLength(1);
    expect(result.list[0]?.companyName).toBe('深圳互联科技集团');
    expect(result.list[0]?.hasAnnouncement).toBe(true);
    expect(result.list[0]).not.toHaveProperty('announcementUrl');
  });

  it('城市搜索只针对 workLocation 做包含匹配', async () => {
    const prisma = createPrismaMock([
      createJob({ workLocation: '北京海淀区' }),
      createJob({ id: 'job-2', workLocation: '上海徐汇区' }),
    ]);
    const service = new JobsService(prisma as never, {} as never, {} as never, createNormalizationMock() as never, createRedisMock() as never);

    const result = await service.getList({ cityKeyword: '海淀', page: 1, limit: 20 }, 'user-1');

    expect(result.list).toHaveLength(1);
    expect(result.list[0]?.workLocation).toContain('海淀');
  });

  it('学历、企业性质、招聘类型、更新时间与搜索框可按且逻辑组合生效', async () => {
    const prisma = createPrismaMock([
      createJob({
        companyFullName: '北京智能制造有限公司',
        workLocation: '北京朝阳区',
        degreeRequirement: '硕士及以上',
        enterpriseNature: '国企',
        recruitmentType: '校招提前批',
        jobName: '产品经理',
        majorRequirement: '产品、设计、市场相关专业',
        updatedAt: new Date('2026-04-28T00:00:00Z'),
      }),
      createJob({
        id: 'job-2',
        companyFullName: '北京智能制造有限公司',
        workLocation: '北京朝阳区',
        degreeRequirement: '本科',
        enterpriseNature: '国企',
        recruitmentType: '实习',
        jobName: '产品经理',
        majorRequirement: '产品、设计、市场相关专业',
        updatedAt: new Date('2026-03-01T00:00:00Z'),
      }),
    ]);
    const service = new JobsService(prisma as never, {} as never, {} as never, createNormalizationMock() as never, createRedisMock() as never);

    const result = await service.getList({
      keyword: '产品',
      cityKeyword: '朝阳',
      degreeRequirement: ['硕士'],
      enterpriseNature: ['国企'],
      recruitmentType: ['校招'],
      updatedWithinDays: [7],
      page: 1,
      limit: 20,
    }, 'user-1');

    expect(result.list).toHaveLength(1);
    expect(result.list[0]?.degreeRequirement).toContain('硕士');
    expect(result.list[0]?.jobType).toContain('校招');
  });

  it('筛选项按业务固定选项返回，不再直接透传数据库全量字段', async () => {
    const prisma = createPrismaMock([
      createJob({ degreeRequirement: '本科', enterpriseNature: '民企', recruitmentType: '校招' }),
      createJob({ id: 'job-2', degreeRequirement: '硕士', enterpriseNature: '国企', recruitmentType: '实习' }),
      createJob({ id: 'job-3', degreeRequirement: '本科', enterpriseNature: '民企', recruitmentType: '校招' }),
    ]);
    const service = new JobsService(prisma as never, {} as never, {} as never, createNormalizationMock() as never, createRedisMock() as never);

    const filters = await service.getFilters();

    expect(filters.degreeOptions).toEqual(['专科', '本科', '硕士', '博士']);
    expect(filters.enterpriseNatureOptions).toEqual(['央企', '国企', '银行', '内资', '外资', '民营', '民企', '股份', '混合', '合资', '上市企业', '社会组织', '事业单位', '外企', '政府单位', '其他']);
    expect(filters.recruitmentTypeOptions).toEqual(['全职', '秋招', '春招', '校招', '实习']);
    expect(filters.jobTypeOptions).toEqual(['全职', '秋招', '春招', '校招', '实习']);
  });

  it('固定筛选项仍支持别名模糊匹配，并为企业性质提供其他兜底', async () => {
    const prisma = createPrismaMock([
      createJob({
        degreeRequirement: '大专及以上',
        recruitmentType: '秋季校园招聘',
        enterpriseNature: '合作社',
      }),
      createJob({
        id: 'job-2',
        degreeRequirement: '本科',
        recruitmentType: '全职',
        enterpriseNature: '国企',
      }),
    ]);
    const service = new JobsService(prisma as never, {} as never, {} as never, createNormalizationMock() as never, createRedisMock() as never);

    const result = await service.getList({
      degreeRequirement: ['专科'],
      recruitmentType: ['秋招'],
      enterpriseNature: ['其他'],
      page: 1,
      limit: 20,
    }, 'user-1');

    expect(result.list).toHaveLength(1);
    expect(result.list[0]?.degreeRequirement).toContain('大专');
    expect(result.list[0]?.jobType).toContain('秋季');
    expect(result.list[0]?.enterpriseNature).toBe('合作社');
  });

  it('仍支持按 userId + progressStatus 追加进度筛选', async () => {
    const prisma = createPrismaMock([
      createJob({ trackings: [{ userId: 'user-1', progressStatus: '已投递' }] }),
      createJob({ id: 'job-2', trackings: [{ userId: 'user-1', progressStatus: '已面试' }] }),
    ]);
    const service = new JobsService(prisma as never, {} as never, {} as never, createNormalizationMock() as never, createRedisMock() as never);

    const result = await service.getList({ progressStatus: '已投递', page: 1, limit: 20 }, 'user-1');

    expect(result.list).toHaveLength(1);
    expect(result.list[0]?.currentProgress).toBe('已投递');
  });

  it('公司简称搜索会并行扩展标准词，避免只搜简称时漏掉全称岗位', async () => {
    const prisma = createPrismaMock([
      createJob({ companyFullName: '中国建设银行股份有限公司', announcementTitle: '中国建设银行 2026 届校园招聘公告' }),
      createJob({ id: 'job-2', companyFullName: '招商银行股份有限公司', announcementTitle: '招商银行 2026 届校园招聘公告' }),
    ]);
    const normalization = createNormalizationMock({
      expandSearchKeywords: vi.fn().mockImplementation(async (domain: string, keyword?: string) => {
        if (domain === 'COMPANY' && keyword === '建行') {
          return ['建行', '建设银行', '中国建设银行'];
        }
        return keyword ? [keyword] : [];
      }),
    });
    const service = new JobsService(prisma as never, {} as never, {} as never, normalization as never, createRedisMock() as never);

    const result = await service.getList({ companyName: '建行', page: 1, limit: 20 }, 'user-1');

    expect(normalization.expandSearchKeywords).toHaveBeenCalledWith('COMPANY', '建行');
    expect(result.list).toHaveLength(1);
    expect(result.list[0]?.companyName).toContain('建设银行');
  });

  it('搜索建议只返回推荐词，不改动用户原始输入', async () => {
    const service = new JobsService(
      createRedisMock() as never,
      {} as never,
      {} as never,
      {
        getMultiDomainSuggestions: vi.fn().mockResolvedValue([
          {
            domain: 'COMPANY',
            canonical: '建设银行',
            matchedAlias: '建行',
            relatedKeywords: ['建设银行', '建行', '中国建设银行'],
          },
        ]),
      } as never,
      {} as never,
    );

    const result = await service.getSearchSuggestions({ keyword: '建行', field: 'company', limit: 8 }, 'user-1');

    expect(result.list).toEqual([
      {
        value: '建设银行',
        label: '建设银行',
        domain: 'COMPANY',
        domainLabel: '企业建议',
        matchText: '建行',
        relatedKeywords: ['建设银行', '建行', '中国建设银行'],
      },
    ]);
  });

  it('免费专区只返回最新更新且链接真实可用的 20 条岗位', async () => {
    const prisma = createPrismaMock([
      createJob({
        id: 'job-invalid-announcement',
        updatedAt: new Date('2026-05-03T00:00:00Z'),
        announcementUrl: 'https://example.com/demo-announcement',
        deliveryUrl: 'https://apply.acme.cn/job-invalid-announcement',
      }),
      createJob({
        id: 'job-invalid-delivery',
        updatedAt: new Date('2026-05-02T00:00:00Z'),
        announcementUrl: 'https://campus.acme.cn/job-invalid-delivery',
        deliveryUrl: 'javascript:void(0)',
      }),
      ...Array.from({ length: 22 }, (_, index) => createJob({
        id: `job-valid-${index + 1}`,
        updatedAt: new Date(`2026-05-${String(22 - index).padStart(2, '0')}T00:00:00Z`),
        announcementUrl: `https://campus.acme.cn/job-valid-${index + 1}`,
        deliveryUrl: `https://apply.acme.cn/job-valid-${index + 1}`,
      })),
    ]);
    const service = new JobsService(prisma as never, {} as never, {} as never, createNormalizationMock() as never, createRedisMock() as never);

    const result = await service.getFreeZoneList('user-1');

    expect(result.list).toHaveLength(20);
    expect(result.list.map((item) => item.id)).toEqual(Array.from({ length: 20 }, (_, index) => `job-valid-${index + 1}`));
    expect(result.list.every((item) => item.hasAnnouncement && item.hasDelivery)).toBe(true);
  });

  it('全部招聘列表会把演示链接和无效链接识别为不可用按钮', async () => {
    const prisma = createPrismaMock([
      createJob({
        id: 'job-invalid-links',
        announcementUrl: 'https://example.com/demo-announcement',
        deliveryUrl: 'javascript:void(0)',
      }),
    ]);
    const service = new JobsService(prisma as never, {} as never, {} as never, createNormalizationMock() as never, createRedisMock() as never);

    const result = await service.getList({ page: 1, limit: 20 }, 'user-1');

    expect(result.list).toHaveLength(1);
    expect(result.list[0]?.hasAnnouncement).toBe(false);
    expect(result.list[0]?.hasDelivery).toBe(false);
    expect(result.list[0]?.canViewAnnouncement).toBe(false);
    expect(result.list[0]?.canDeliver).toBe(false);
  });

  it('全部招聘列表会按包含 @ 的投递字段识别为邮箱投递', async () => {
    const prisma = createPrismaMock([
      createJob({
        id: 'job-email-delivery',
        announcementUrl: 'https://campus.acme.cn/job-email-delivery',
        deliveryUrl: '简历投递邮箱：hr@acme.cn',
      }),
    ]);
    const service = new JobsService(prisma as never, {} as never, {} as never, createNormalizationMock() as never, createRedisMock() as never);

    const result = await service.getList({ page: 1, limit: 20 }, 'user-1');

    expect(result.list).toHaveLength(1);
    expect(result.list[0]?.hasDelivery).toBe(true);
    expect(result.list[0]?.deliveryType).toBe('email');
  });

  it('无筛选条件翻到后续页时不会触发规律翻页风控拦截', async () => {
    const prisma = createPrismaMock([
      createJob({ id: 'job-1' }),
      createJob({ id: 'job-2' }),
      createJob({ id: 'job-3' }),
    ]);
    const redis = createRedisMock();
    const service = new JobsService(prisma as never, {} as never, {} as never, createNormalizationMock() as never, redis as never);

    const result = await service.getList({ page: 2, limit: 1 }, 'user-1');

    expect(result.list).toHaveLength(1);
    expect(result.pagination.page).toBe(2);
    expect(result.pagination.hasMore).toBe(true);
    expect(redis.zadd).not.toHaveBeenCalled();
  });

  it('登录用户带筛选条件翻到较后页时不会触发列表翻页风控', async () => {
    const prisma = createPrismaMock([
      createJob({ id: 'job-1', jobName: '产品经理' }),
      createJob({ id: 'job-2', jobName: '产品运营' }),
      createJob({ id: 'job-3', jobName: '产品策划' }),
    ]);
    const redis = createRedisMock();
    const service = new JobsService(prisma as never, {} as never, {} as never, createNormalizationMock() as never, redis as never);

    const result = await service.getList({ keyword: '产品', page: 3, limit: 1 }, 'user-1');

    expect(result.pagination.page).toBe(3);
    expect(redis.zadd).not.toHaveBeenCalled();
  });

  it('未登录用户继续深翻默认列表时仍保留列表翻页风控识别', async () => {
    const prisma = createPrismaMock([
      createJob({ id: 'job-1' }),
      createJob({ id: 'job-2' }),
      createJob({ id: 'job-3' }),
    ]);
    const redis = createRedisMock();
    const service = new JobsService(prisma as never, {} as never, {} as never, createNormalizationMock() as never, redis as never);

    await service.getList({ page: 2, limit: 1 }, null, {
      ip: '127.0.0.1',
      deviceId: 'device-1',
      sessionId: 'session-1',
    });

    expect(redis.zadd).toHaveBeenCalled();
  });
});
