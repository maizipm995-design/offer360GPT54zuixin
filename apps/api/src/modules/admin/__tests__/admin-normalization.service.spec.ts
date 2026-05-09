import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminNormalizationService } from '../admin-normalization.service';

const clearAllJobsRecommendationCache = vi.fn();

vi.mock('../../jobs/jobs-recommendation-cache', () => ({
  clearAllJobsRecommendationCache: () => clearAllJobsRecommendationCache(),
}));

function createService() {
  const prisma = {
    normalizationTerm: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    normalizationAlias: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    locationHierarchy: {
      findUnique: vi.fn(),
    },
  };

  const normalizationService = {
    normalizeTextForMatch: vi.fn((value?: string | null) => String(value ?? '').trim().toLowerCase()),
    clearCache: vi.fn(),
  };

  const service = new AdminNormalizationService(prisma as never, normalizationService as never);
  return { prisma, normalizationService, service };
}

describe('AdminNormalizationService', () => {
  beforeEach(() => {
    clearAllJobsRecommendationCache.mockReset();
  });

  it('创建地点词条时缺少 level 会报错', async () => {
    const { service } = createService();

    await expect(service.createTerm({
      domain: 'LOCATION',
      canonicalName: '山东',
      status: 'active',
    })).rejects.toThrow('地点词条必须选择省份或城市层级');
  });

  it('创建别名时若与标准词重复会报错', async () => {
    const { prisma, service } = createService();
    prisma.normalizationTerm.findUnique.mockResolvedValue({
      id: 'term-1',
      domain: 'COMPANY',
      canonicalName: '中国烟草',
      canonicalCode: null,
      level: null,
      status: 'active',
      sortOrder: 0,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(service.createAlias('term-1', {
      aliasName: '中国烟草',
      matchMode: 'contains',
      status: 'active',
      sortOrder: 0,
    })).rejects.toThrow('别名无需与标准词重复');
  });

  it('创建标准词成功后会清空标准化缓存和推荐缓存', async () => {
    const { prisma, normalizationService, service } = createService();
    const createdAt = new Date('2026-04-28T00:00:00Z');

    prisma.normalizationTerm.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'term-1',
        domain: 'JOB_TITLE',
        canonicalName: '软件开发',
        canonicalCode: 'job-dev',
        level: null,
        status: 'active',
        sortOrder: 10,
        metadata: null,
        createdAt,
        updatedAt: createdAt,
        _count: { aliases: 0 },
      });
    prisma.normalizationTerm.create.mockResolvedValue({ id: 'term-1' });

    const result = await service.createTerm({
      domain: 'JOB_TITLE',
      canonicalName: '软件开发',
      canonicalCode: 'job-dev',
      status: 'active',
      sortOrder: 10,
    });

    expect(result.canonicalName).toBe('软件开发');
    expect(normalizationService.clearCache).toHaveBeenCalledTimes(1);
    expect(clearAllJobsRecommendationCache).toHaveBeenCalledTimes(1);
  });

  it('更新标准词时允许清空编码和 metadata', async () => {
    const { prisma, service } = createService();
    const updatedAt = new Date('2026-04-28T02:00:00Z');

    prisma.normalizationTerm.findUnique
      .mockResolvedValueOnce({
        id: 'term-1',
        domain: 'JOB_TITLE',
        canonicalName: '软件开发',
        canonicalCode: 'job-dev',
        level: null,
        status: 'active',
        sortOrder: 10,
        metadata: { source: 'manual' },
        createdAt: updatedAt,
        updatedAt,
        _count: { aliases: 0, locationAsProvince: 0, locationAsCity: 0 },
      })
      .mockResolvedValueOnce({
        id: 'term-1',
        domain: 'JOB_TITLE',
        canonicalName: '软件开发',
        canonicalCode: 'job-dev',
        level: null,
        status: 'active',
        sortOrder: 10,
        metadata: { source: 'manual' },
        createdAt: updatedAt,
        updatedAt,
        aliases: [],
      })
      .mockResolvedValueOnce({
        id: 'term-1',
        domain: 'JOB_TITLE',
        canonicalName: '软件开发',
        canonicalCode: null,
        level: null,
        status: 'active',
        sortOrder: 10,
        metadata: null,
        createdAt: updatedAt,
        updatedAt,
        _count: { aliases: 0 },
      });
    prisma.normalizationTerm.update.mockResolvedValue({ id: 'term-1' });

    const result = await service.updateTerm('term-1', {
      canonicalCode: null,
      metadata: null,
    } as never, { skipCacheRefresh: true });

    expect(prisma.normalizationTerm.update).toHaveBeenCalledWith({
      where: { id: 'term-1' },
      data: expect.objectContaining({
        canonicalCode: null,
        metadata: Prisma.JsonNull,
      }),
    });
    expect(result.canonicalCode).toBeNull();
    expect(result.metadata).toBeNull();
  });

  it('更新别名时允许清空来源字段', async () => {
    const { prisma, service } = createService();
    const updatedAt = new Date('2026-04-28T03:00:00Z');

    prisma.normalizationAlias.findUnique
      .mockResolvedValueOnce({
        id: 'alias-1',
        termId: 'term-1',
        aliasName: 'Java研发',
        aliasNormalized: 'java研发',
        matchMode: 'exact',
        status: 'active',
        source: 'manual',
        sortOrder: 10,
        createdAt: updatedAt,
        updatedAt,
      })
      .mockResolvedValueOnce(null);
    prisma.normalizationTerm.findUnique.mockResolvedValue({
      id: 'term-1',
      domain: 'JOB_TITLE',
      canonicalName: 'Java后端开发',
      canonicalCode: null,
      level: null,
      status: 'active',
      sortOrder: 10,
      metadata: null,
      createdAt: updatedAt,
      updatedAt,
    });
    prisma.normalizationAlias.update.mockResolvedValue({
      id: 'alias-1',
      termId: 'term-1',
      aliasName: 'Java研发',
      aliasNormalized: 'java研发',
      matchMode: 'exact',
      status: 'active',
      source: null,
      sortOrder: 10,
      createdAt: updatedAt,
      updatedAt,
    });

    const result = await service.updateAlias('alias-1', {
      source: null,
    } as never, { skipCacheRefresh: true });

    expect(prisma.normalizationAlias.update).toHaveBeenCalledWith({
      where: { id: 'alias-1' },
      data: expect.objectContaining({ source: null }),
    });
    expect(result.source).toBeNull();
  });

  it('创建省市关系时会拦截停用的地点词条', async () => {
    const { prisma, service } = createService();
    const updatedAt = new Date('2026-04-28T04:00:00Z');

    prisma.normalizationTerm.findUnique
      .mockResolvedValueOnce({
        id: 'province-1',
        domain: 'LOCATION',
        canonicalName: '山东',
        canonicalCode: 'CN-SD',
        level: 'province',
        status: 'inactive',
        sortOrder: 10,
        metadata: null,
        createdAt: updatedAt,
        updatedAt,
      })
      .mockResolvedValueOnce({
        id: 'city-1',
        domain: 'LOCATION',
        canonicalName: '济南',
        canonicalCode: 'CN-JN',
        level: 'city',
        status: 'active',
        sortOrder: 20,
        metadata: null,
        createdAt: updatedAt,
        updatedAt,
      });

    await expect(service.createLocationHierarchy({
      provinceTermId: 'province-1',
      cityTermId: 'city-1',
      status: 'active',
    })).rejects.toThrow('省份和城市词条都必须处于启用状态后才能建立关系');
  });
});
