import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsersService } from './users.service';

const invalidateJobsRecommendationCacheByUserId = vi.fn();

vi.mock('../jobs/jobs-recommendation-cache', () => ({
  invalidateJobsRecommendationCacheByUserId: (userId: string) => invalidateJobsRecommendationCacheByUserId(userId),
}));

describe('UsersService', () => {
  beforeEach(() => {
    invalidateJobsRecommendationCacheByUserId.mockReset();
  });

  it('更新个人资料时会先把学历和专业收敛为标准词再写库', async () => {
    const prisma = {
      userProfile: {
        upsert: vi.fn().mockResolvedValue({
          userId: 'user-1',
          name: '张三',
          degree: '本科',
          major: '计算机',
        }),
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
    };
    const service = new UsersService(prisma as never, normalizationService as never, {} as never);

    await service.updateProfile('user-1', {
      name: '张三',
      degree: '全日制本科',
      major: '计算机科学与技术',
    });

    expect(normalizationService.normalizeOptionalValueForStorage).toHaveBeenNthCalledWith(1, 'DEGREE', '全日制本科');
    expect(normalizationService.normalizeOptionalValueForStorage).toHaveBeenNthCalledWith(2, 'MAJOR', '计算机科学与技术');
    expect(prisma.userProfile.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      update: {
        name: '张三',
        degree: '本科',
        major: '计算机',
      },
      create: {
        userId: 'user-1',
        name: '张三',
        degree: '本科',
        major: '计算机',
      },
    });
    expect(invalidateJobsRecommendationCacheByUserId).toHaveBeenCalledWith('user-1');
  });

  it('更新求职意向时会先做去空去重与 canonical 收敛再写库', async () => {
    const prisma = {
      userJobPreferenceTag: {
        upsert: vi.fn().mockResolvedValue({
          userId: 'user-1',
          intentionCity: ['深圳'],
          intentionJob: ['开发', '产品'],
          intentionCompany: ['中国烟草'],
        }),
      },
    };
    const normalizationService = {
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
    const service = new UsersService(prisma as never, normalizationService as never, {} as never);

    const result = await service.updatePreferences('user-1', {
      intentionCity: ['深', '深圳市', '深', '  '],
      intentionJob: ['软件开发工程师', '产品经理'],
      intentionCompany: ['烟草', '中国烟草'],
    });

    expect(normalizationService.normalizePreferencesForStorage).toHaveBeenNthCalledWith(1, 'LOCATION', ['深', '深圳市']);
    expect(normalizationService.normalizePreferencesForStorage).toHaveBeenNthCalledWith(2, 'JOB_TITLE', ['软件开发工程师', '产品经理']);
    expect(normalizationService.normalizePreferencesForStorage).toHaveBeenNthCalledWith(3, 'COMPANY', ['烟草', '中国烟草']);
    expect(prisma.userJobPreferenceTag.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      update: {
        intentionCity: ['深圳'],
        intentionJob: ['开发', '产品'],
        intentionCompany: ['中国烟草'],
      },
      create: {
        userId: 'user-1',
        intentionCity: ['深圳'],
        intentionJob: ['开发', '产品'],
        intentionCompany: ['中国烟草'],
      },
    });
    expect(result.normalizedPreference).toEqual({
      intentionCity: ['深圳'],
      intentionJob: ['开发', '产品'],
      intentionCompany: ['中国烟草'],
    });
    expect(invalidateJobsRecommendationCacheByUserId).toHaveBeenCalledWith('user-1');
  });
});
