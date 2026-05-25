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

  it('更新求职意向时保留用户原始输入，同时返回标准词结果供推荐使用', async () => {
    const prisma = {
      userJobPreferenceTag: {
        upsert: vi.fn().mockResolvedValue({
          userId: 'user-1',
          intentionCity: ['深', '深圳市'],
          intentionJob: ['软件开发工程师', '产品经理'],
          intentionCompany: ['烟草', '中国烟草'],
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
        intentionCity: ['深', '深圳市'],
        intentionJob: ['软件开发工程师', '产品经理'],
        intentionCompany: ['烟草', '中国烟草'],
      },
      create: {
        userId: 'user-1',
        intentionCity: ['深', '深圳市'],
        intentionJob: ['软件开发工程师', '产品经理'],
        intentionCompany: ['烟草', '中国烟草'],
      },
    });
    expect(result.normalizedPreference).toEqual({
      intentionCity: ['深圳'],
      intentionJob: ['开发', '产品'],
      intentionCompany: ['中国烟草'],
    });
    expect(result.intentionCity).toEqual(['深', '深圳市']);
    expect(result.intentionJob).toEqual(['软件开发工程师', '产品经理']);
    expect(result.intentionCompany).toEqual(['烟草', '中国烟草']);
    expect(invalidateJobsRecommendationCacheByUserId).toHaveBeenCalledWith('user-1');
  });

  it('首页引导弹窗按八项字段完成状态动态判断是否需要弹出', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'user-1',
          phone: '13800000000',
          myInviteCode: 'INV001',
          profile: { name: '张三', degree: '本科', major: '计算机' },
          preference: {
            intentionCity: ['北京'],
            intentionJob: [],
            intentionCompany: ['字节跳动'],
          },
          membership: null,
          wallet: null,
        }),
      },
      memberRole: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue(undefined),
      },
    };
    const normalizationService = {
      normalizeOptionalValueForStorage: vi.fn().mockResolvedValue(undefined),
      normalizePreferencesForStorage: vi.fn().mockResolvedValue([]),
    };
    const service = new UsersService(prisma as never, normalizationService as never, {} as never);

    const overview = await service.getOverview('user-1');

    expect(overview.profileOnboardingRequired).toBe(true);
    expect(overview.needsProfileOnboarding).toBe(true);
    expect(overview.profileOnboardingStatus).toEqual({
      name: true,
      intentionCity: true,
      intentionJob: false,
      intentionCompany: true,
      schoolName: false,
      major: true,
      graduationYear: false,
      degree: true,
    });
  });

  it('概览判定会合并已保存的资料状态，八项齐全后不再重复弹窗', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'user-1',
          phone: '13800000000',
          myInviteCode: 'INV001',
          profile: { name: '张三', degree: '本科', major: '计算机', schoolName: '清华大学', graduationYear: 2027 },
          preference: {
            intentionCity: ['北京'],
            intentionJob: ['  '],
            intentionCompany: ['字节跳动'],
          },
          membership: null,
          wallet: null,
        }),
      },
      memberRole: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue(undefined),
      },
    };
    const normalizationService = {
      normalizeOptionalValueForStorage: vi.fn().mockResolvedValue(undefined),
      normalizePreferencesForStorage: vi.fn().mockImplementation(async (domain: string, input?: string[] | null) => {
        if (domain === 'LOCATION') {
          return input ?? [];
        }
        if (domain === 'JOB_TITLE') {
          return ['前端开发'];
        }
        if (domain === 'COMPANY') {
          return input ?? [];
        }
        return input ?? [];
      }),
    };
    const service = new UsersService(prisma as never, normalizationService as never, {} as never);

    const overview = await service.getOverview('user-1');

    expect(overview.profileOnboardingRequired).toBe(false);
    expect(overview.needsProfileOnboarding).toBe(false);
    expect(overview.profileOnboardingStatus).toEqual({
      name: true,
      intentionCity: true,
      intentionJob: true,
      intentionCompany: true,
      schoolName: true,
      major: true,
      graduationYear: true,
      degree: true,
    });
    expect(overview.normalizedPreference).toEqual({
      intentionCity: ['北京'],
      intentionJob: ['前端开发'],
      intentionCompany: ['字节跳动'],
    });
  });

  it('消费首页资料引导后会关闭首次弹窗标记', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'user-1' }),
        update: vi.fn().mockResolvedValue({ id: 'user-1' }),
      },
    };
    const service = new UsersService(prisma as never, {} as never, {} as never);

    const result = await service.consumeProfileOnboarding('user-1');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { id: true },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { needsProfileOnboarding: false },
    });
    expect(result).toEqual({ consumed: true });
  });
});
