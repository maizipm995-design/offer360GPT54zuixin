import { describe, expect, it, vi } from 'vitest';
import { AdminService } from '../admin.service';

function createService() {
  const prisma = {};
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
    normalizationService,
    service: new AdminService(prisma as never, normalizationService as never),
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
});
