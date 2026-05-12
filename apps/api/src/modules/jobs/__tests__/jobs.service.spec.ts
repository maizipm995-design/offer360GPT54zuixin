import { describe, expect, it, vi } from 'vitest';
import { JobsRecommendationService } from '../jobs-recommendation.service';
import { JobsNormalizationService } from '../jobs-normalization.service';
import { JobsService } from '../jobs.service';

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
    companyFullName: '上海互联网科技有限公司',
    enterpriseNature: '民企',
    degreeRequirement: '本科及以上',
    workLocation: '上海市浦东新区',
    jobName: '前端开发工程师',
    jobCategory: '互联网技术类',
    recruitmentType: '校招',
    deadlineAt: '2099-12-31',
    announcementUrl: 'https://example.com/job-1',
    deliveryUrl: 'https://example.com/deliver/job-1',
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
  if (where.jobCategory?.contains && !matchesStringContains(job.jobCategory, where.jobCategory.contains)) return false;
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
    $transaction: vi.fn().mockImplementation((items: unknown[]) => Promise.all(items as Promise<unknown>[])),
  };
}

describe('JobsService fuzzy search filters', () => {
  it('通用搜索会重点命中公司名、岗位名和岗位类别，并覆盖单表文本字段模糊匹配', async () => {
    const prisma = createPrismaMock([
      createJob({ companyFullName: '深圳互联科技集团', jobName: '算法工程师', jobCategory: '人工智能研发类' }),
      createJob({ id: 'job-2', companyFullName: '江苏电力集团', jobName: '行政专员', jobCategory: '职能类' }),
    ]);
    const service = new JobsService(prisma as never, {} as never, {} as never, { normalizeLocationPreferences: vi.fn().mockResolvedValue([]) } as never);

    const result = await service.getList({ keyword: '互联科技', page: 1, limit: 20 });

    expect(result.list).toHaveLength(1);
    expect(result.list[0]?.companyName).toBe('深圳互联科技集团');
  });

  it('城市搜索只针对 workLocation 做包含匹配', async () => {
    const prisma = createPrismaMock([
      createJob({ workLocation: '北京海淀区' }),
      createJob({ id: 'job-2', workLocation: '上海徐汇区' }),
    ]);
    const service = new JobsService(prisma as never, {} as never, {} as never, { normalizeLocationPreferences: vi.fn().mockResolvedValue([]) } as never);

    const result = await service.getList({ cityKeyword: '海淀', page: 1, limit: 20 });

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
        jobCategory: '产品类',
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
        jobCategory: '产品类',
        updatedAt: new Date('2026-03-01T00:00:00Z'),
      }),
    ]);
    const service = new JobsService(prisma as never, {} as never, {} as never, { normalizeLocationPreferences: vi.fn().mockResolvedValue([]) } as never);

    const result = await service.getList({
      keyword: '产品',
      cityKeyword: '朝阳',
      degreeRequirement: ['硕士'],
      enterpriseNature: ['国企'],
      recruitmentType: ['校招'],
      updatedWithinDays: [7],
      page: 1,
      limit: 20,
    });

    expect(result.list).toHaveLength(1);
    expect(result.list[0]?.degreeRequirement).toContain('硕士');
    expect(result.list[0]?.jobType).toContain('校招');
  });

  it('筛选项直接来自 job_announcements 对应字段并自动去重', async () => {
    const prisma = createPrismaMock([
      createJob({ degreeRequirement: '本科', enterpriseNature: '民企', recruitmentType: '校招' }),
      createJob({ id: 'job-2', degreeRequirement: '硕士', enterpriseNature: '国企', recruitmentType: '实习' }),
      createJob({ id: 'job-3', degreeRequirement: '本科', enterpriseNature: '民企', recruitmentType: '校招' }),
    ]);
    const service = new JobsService(prisma as never, {} as never, {} as never, { normalizeLocationPreferences: vi.fn().mockResolvedValue([]) } as never);

    const filters = await service.getFilters();

    expect(filters.degreeOptions).toEqual(['本科', '硕士']);
    expect(filters.enterpriseNatureOptions).toEqual(['国企', '民企']);
    expect(filters.recruitmentTypeOptions).toEqual(['实习', '校招']);
  });

  it('仍支持按 userId + progressStatus 追加进度筛选', async () => {
    const prisma = createPrismaMock([
      createJob({ trackings: [{ userId: 'user-1', progressStatus: '已投递' }] }),
      createJob({ id: 'job-2', trackings: [{ userId: 'user-1', progressStatus: '已面试' }] }),
    ]);
    const service = new JobsService(prisma as never, {} as never, {} as never, { normalizeLocationPreferences: vi.fn().mockResolvedValue([]) } as never);

    const result = await service.getList({ userId: 'user-1', progressStatus: '已投递', page: 1, limit: 20 });

    expect(result.list).toHaveLength(1);
    expect(result.list[0]?.currentProgress).toBe('已投递');
  });
});
