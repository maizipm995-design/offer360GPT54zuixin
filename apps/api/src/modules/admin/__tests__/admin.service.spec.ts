import { describe, expect, it, vi } from 'vitest';
import { AdminService } from '../admin.service';

function createService() {
  const prisma = {
    jobAnnouncement: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
  const normalizationService = {
    normalizeOptionalValueForStorage: vi.fn().mockImplementation(async (domain: string, input?: string | null) => {
      if (domain === 'DEGREE') {
        return input === '全日制本科' ? '本科' : input;
      }
      if (domain === 'MAJOR') {
        return input === '计算机科学与技术' ? '计算机' : input;
      }
      return input;
    }),
    normalizePreferencesForStorage: vi.fn().mockImplementation(async (domain: string, input?: string[] | null) => {
      if (domain === 'LOCATION') {
        return input?.includes('深') ? ['深圳'] : input;
      }
      if (domain === 'JOB_TITLE') {
        return ['开发', '产品'];
      }
      if (domain === 'COMPANY') {
        return ['中国烟草'];
      }
      return input;
    }),
  };

  return {
    prisma,
    normalizationService,
    service: new AdminService(prisma as never, normalizationService as never, {} as never, {} as never),
  };
}

describe('AdminService standardization helpers', () => {
  it('新建招聘公告时会把录入日期为空的记录自动补为当前系统时间', () => {
    const { service } = createService();
    const result = service.buildJobCreateInput({
      companyFullName: '测试企业',
      entryDate: '',
    });

    expect(result.entryDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it('新建招聘公告时会把表格填写的录入日期同步写入创建时间', () => {
    const { service } = createService();
    const result = service.buildJobCreateInput({
      companyFullName: '测试企业',
      entryDate: '2026-04-20',
    });

    expect(result.entryDate).toBe('2026-04-20');
    expect(result.createdAt).toEqual(new Date(2026, 3, 20));
  });

  it('新建招聘公告时会优先写入专业需求字段，并兼容旧字段别名', () => {
    const { service } = createService();
    const result = service.buildJobCreateInput({
      companyFullName: '测试企业',
      jobCategory: '计算机类相关专业',
    });

    expect(result.majorRequirement).toBe('计算机类相关专业');
    expect(result.graduationSession).toBeNull();
  });

  it('后台用户资料输入会先把学历和专业收敛为标准词', async () => {
    const { service, normalizationService } = createService();

    const result = await (service as any).toUserProfileInput({
      name: '张三',
      graduationYear: 2026,
      schoolName: '南京大学',
      degree: '全日制本科',
      major: '计算机科学与技术',
    });

    expect(normalizationService.normalizeOptionalValueForStorage).toHaveBeenNthCalledWith(1, 'DEGREE', '全日制本科');
    expect(normalizationService.normalizeOptionalValueForStorage).toHaveBeenNthCalledWith(2, 'MAJOR', '计算机科学与技术');
    expect(result).toEqual({
      name: '张三',
      graduationYear: 2026,
      degree: '本科',
      schoolName: '南京大学',
      major: '计算机',
    });
  });

  it('后台用户求职意向输入会先按 canonical 口径收敛', async () => {
    const { service, normalizationService } = createService();

    const result = await (service as any).toUserPreferenceInput({
      intentionCity: ['深', '深圳市'],
      intentionJob: ['软件开发工程师', '产品经理'],
      intentionCompany: ['烟草', '中国烟草'],
    });

    expect(normalizationService.normalizePreferencesForStorage).toHaveBeenNthCalledWith(1, 'LOCATION', ['深', '深圳市']);
    expect(normalizationService.normalizePreferencesForStorage).toHaveBeenNthCalledWith(2, 'JOB_TITLE', ['软件开发工程师', '产品经理']);
    expect(normalizationService.normalizePreferencesForStorage).toHaveBeenNthCalledWith(3, 'COMPANY', ['烟草', '中国烟草']);
    expect(result).toEqual({
      intentionCity: ['深圳'],
      intentionJob: ['开发', '产品'],
      intentionCompany: ['中国烟草'],
    });
  });

  it('招聘公告去重预览只按五字段分组，并保留更新时间最新的一条', async () => {
    const { service, prisma } = createService();
    prisma.jobAnnouncement.findMany.mockResolvedValue([
      {
        id: 'job-new',
        companyFullName: '示例科技',
        workLocation: '北京',
        jobName: '后端工程师',
        announcementUrl: 'https://example.com/a',
        deliveryUrl: 'https://example.com/delivery',
        announcementTitle: '2026 校招',
        enterpriseNature: null,
        degreeRequirement: null,
        majorRequirement: null,
        recruitmentType: null,
        deadlineAt: null,
        graduationSession: null,
        referralCode: null,
        industry: null,
        entryDate: '2026-05-01',
        createdAt: new Date('2026-05-01T08:00:00.000Z'),
        updatedAt: new Date('2026-05-03T08:00:00.000Z'),
      },
      {
        id: 'job-old',
        companyFullName: '示例科技',
        workLocation: '北京',
        jobName: '后端工程师',
        announcementUrl: 'https://example.com/a',
        deliveryUrl: 'https://example.com/delivery',
        announcementTitle: '2026 校招旧版本',
        enterpriseNature: null,
        degreeRequirement: null,
        majorRequirement: null,
        recruitmentType: null,
        deadlineAt: null,
        graduationSession: null,
        referralCode: null,
        industry: null,
        entryDate: '2026-04-28',
        createdAt: new Date('2026-04-28T08:00:00.000Z'),
        updatedAt: new Date('2026-05-01T08:00:00.000Z'),
      },
      {
        id: 'job-different-location',
        companyFullName: '示例科技',
        workLocation: '上海',
        jobName: '后端工程师',
        announcementUrl: 'https://example.com/a',
        deliveryUrl: 'https://example.com/delivery',
        announcementTitle: '仅地点不同',
        enterpriseNature: null,
        degreeRequirement: null,
        majorRequirement: null,
        recruitmentType: null,
        deadlineAt: null,
        graduationSession: null,
        referralCode: null,
        industry: null,
        entryDate: '2026-05-02',
        createdAt: new Date('2026-05-02T08:00:00.000Z'),
        updatedAt: new Date('2026-05-02T08:00:00.000Z'),
      },
      {
        id: 'job-empty-a',
        companyFullName: '',
        workLocation: '',
        jobName: null,
        announcementUrl: null,
        deliveryUrl: null,
        announcementTitle: null,
        enterpriseNature: null,
        degreeRequirement: null,
        majorRequirement: null,
        recruitmentType: null,
        deadlineAt: null,
        graduationSession: null,
        referralCode: null,
        industry: null,
        entryDate: '2026-04-01',
        createdAt: new Date('2026-04-01T08:00:00.000Z'),
        updatedAt: new Date('2026-04-01T08:00:00.000Z'),
      },
      {
        id: 'job-empty-b',
        companyFullName: '',
        workLocation: '',
        jobName: null,
        announcementUrl: null,
        deliveryUrl: null,
        announcementTitle: null,
        enterpriseNature: null,
        degreeRequirement: null,
        majorRequirement: null,
        recruitmentType: null,
        deadlineAt: null,
        graduationSession: null,
        referralCode: null,
        industry: null,
        entryDate: '2026-04-02',
        createdAt: new Date('2026-04-02T08:00:00.000Z'),
        updatedAt: new Date('2026-04-02T08:00:00.000Z'),
      },
    ]);

    const result = await service.getJobsDeduplicationPreview();

    expect(result.scannedCount).toBe(5);
    expect(result.duplicateGroupCount).toBe(1);
    expect(result.pendingDeleteCount).toBe(1);
    expect(result.groups[0]?.keepRecord.id).toBe('job-new');
    expect(result.groups[0]?.removeRecords.map((item) => item.id)).toEqual(['job-old']);
    expect(result.groups[0]?.companyFullName).toBe('示例科技');
    expect(result.groups[0]?.workLocation).toBe('北京');
  });

  it('招聘公告智能去重会删除每组除最新记录外的所有历史重复公告', async () => {
    const { service, prisma } = createService();
    prisma.jobAnnouncement.findMany.mockResolvedValue([
      {
        id: 'keep-id',
        companyFullName: '示例科技',
        workLocation: '深圳',
        jobName: '算法工程师',
        announcementUrl: 'https://example.com/announce',
        deliveryUrl: 'https://example.com/apply',
        announcementTitle: '最新版本',
        enterpriseNature: null,
        degreeRequirement: null,
        majorRequirement: null,
        recruitmentType: null,
        deadlineAt: null,
        graduationSession: null,
        referralCode: null,
        industry: null,
        entryDate: '2026-05-05',
        createdAt: new Date('2026-05-05T08:00:00.000Z'),
        updatedAt: new Date('2026-05-06T08:00:00.000Z'),
      },
      {
        id: 'remove-id-1',
        companyFullName: '示例科技',
        workLocation: '深圳',
        jobName: '算法工程师',
        announcementUrl: 'https://example.com/announce',
        deliveryUrl: 'https://example.com/apply',
        announcementTitle: '旧版本 1',
        enterpriseNature: null,
        degreeRequirement: null,
        majorRequirement: null,
        recruitmentType: null,
        deadlineAt: null,
        graduationSession: null,
        referralCode: null,
        industry: null,
        entryDate: '2026-05-01',
        createdAt: new Date('2026-05-01T08:00:00.000Z'),
        updatedAt: new Date('2026-05-02T08:00:00.000Z'),
      },
      {
        id: 'remove-id-2',
        companyFullName: '示例科技',
        workLocation: '深圳',
        jobName: '算法工程师',
        announcementUrl: 'https://example.com/announce',
        deliveryUrl: 'https://example.com/apply',
        announcementTitle: '旧版本 2',
        enterpriseNature: null,
        degreeRequirement: null,
        majorRequirement: null,
        recruitmentType: null,
        deadlineAt: null,
        graduationSession: null,
        referralCode: null,
        industry: null,
        entryDate: '2026-04-28',
        createdAt: new Date('2026-04-28T08:00:00.000Z'),
        updatedAt: new Date('2026-04-29T08:00:00.000Z'),
      },
    ]);
    prisma.jobAnnouncement.deleteMany.mockResolvedValue({ count: 2 });

    const result = await service.executeJobsDeduplication();

    expect(prisma.jobAnnouncement.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['remove-id-1', 'remove-id-2'] } },
    });
    expect(result.keptCount).toBe(1);
    expect(result.deletedCount).toBe(2);
  });
});
