import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assertUserHasMemberPermission } from '../../../common/utils/member-access';
import { JobsService } from '../jobs.service';

vi.mock('../../../common/utils/member-access', () => ({
  assertUserHasMemberPermission: vi.fn(),
  getUserMemberAccess: vi.fn(),
}));

function createRedisServiceMock() {
  const store = new Map<string, string>();
  const counters = new Map<string, number>();
  const sets = new Map<string, Set<string>>();
  const sortedSets = new Map<string, Array<{ score: number; member: string }>>();

  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    incr: vi.fn(async (key: string) => {
      const next = (counters.get(key) ?? 0) + 1;
      counters.set(key, next);
      return next;
    }),
    expire: vi.fn(async () => undefined),
    zadd: vi.fn(async (key: string, score: number, member: string) => {
      const list = sortedSets.get(key) ?? [];
      list.push({ score, member });
      sortedSets.set(key, list);
    }),
    zremrangebyscore: vi.fn(async (key: string, min: number | string, max: number | string) => {
      const minScore = Number(min);
      const maxScore = Number(max);
      const list = (sortedSets.get(key) ?? []).filter((item) => item.score < minScore || item.score > maxScore);
      sortedSets.set(key, list);
    }),
    zcard: vi.fn(async (key: string) => (sortedSets.get(key) ?? []).length),
    zrange: vi.fn(async (key: string, start: number, stop: number) => {
      const list = [...(sortedSets.get(key) ?? [])].sort((a, b) => a.score - b.score).map((item) => item.member);
      const normalizedStop = stop < 0 ? list.length + stop : stop;
      return list.slice(start, normalizedStop + 1);
    }),
    sadd: vi.fn(async (key: string, ...members: string[]) => {
      const set = sets.get(key) ?? new Set<string>();
      members.forEach((member) => set.add(member));
      sets.set(key, set);
    }),
    smembers: vi.fn(async (key: string) => Array.from(sets.get(key) ?? [])),
  };
}

function createAccessPrismaMock() {
  const trackingStore = new Map<string, { progressStatus: string }>();
  const job = {
    id: 'job-1',
    status: 'published',
    announcementUrl: 'https://campus.acme.cn/jobs/1',
    deliveryUrl: 'https://apply.acme.cn/delivery/1',
    referralCode: null,
  };

  return {
    prisma: {
      jobAnnouncement: {
        findUnique: vi.fn().mockImplementation(async ({ where }: { where: { id: string } }) => (
          where.id === job.id ? job : null
        )),
      },
      userMembership: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'membership-1',
          memberLevel: 'standard',
        }),
      },
      adminBootstrapConfig: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({ id: 1 }),
      },
      userJobTracking: {
        findUnique: vi.fn().mockImplementation(async ({ where }: { where: { userId_jobId: { userId: string; jobId: string } } }) => (
          trackingStore.get(`${where.userId_jobId.userId}:${where.userId_jobId.jobId}`) ?? null
        )),
        upsert: vi.fn().mockImplementation(async ({
          where,
          update,
          create,
        }: {
          where: { userId_jobId: { userId: string; jobId: string } };
          update: { progressStatus: string };
          create: { userId: string; jobId: string; progressStatus: string };
        }) => {
          const key = `${where.userId_jobId.userId}:${where.userId_jobId.jobId}`;
          const next = trackingStore.has(key)
            ? { progressStatus: update.progressStatus }
            : { progressStatus: create.progressStatus };
          trackingStore.set(key, next);
          return next;
        }),
      },
      $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
      $queryRawUnsafe: vi.fn().mockResolvedValue([]),
      $transaction: vi.fn().mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({})),
    },
  };
}

function createService(prisma: ReturnType<typeof createAccessPrismaMock>['prisma']) {
  const redisService = createRedisServiceMock();
  return new JobsService(
    prisma as never,
    {} as never,
    {
      recordAccessClick: vi.fn().mockResolvedValue(undefined),
      recordDeliveryMark: vi.fn().mockResolvedValue(undefined),
    } as never,
    {} as never,
    redisService as never,
  );
}

function createServiceBundle(prisma: ReturnType<typeof createAccessPrismaMock>['prisma']) {
  const redisService = createRedisServiceMock();
  return {
    redisService,
    service: new JobsService(
      prisma as never,
      {} as never,
      {
        recordAccessClick: vi.fn().mockResolvedValue(undefined),
        recordDeliveryMark: vi.fn().mockResolvedValue(undefined),
      } as never,
      {} as never,
      redisService as never,
    ),
  };
}

describe('JobsService announcement access control', () => {
  beforeEach(() => {
    vi.mocked(assertUserHasMemberPermission).mockReset();
    vi.mocked(assertUserHasMemberPermission).mockResolvedValue({
      isMember: true,
      memberLevel: 'standard',
      memberLevelLabel: '标准会员',
      memberRoleCode: 'STANDARD_MEMBER',
      memberRoleName: '标准会员',
      permissionKeys: ['jobs:detail:view', 'jobs:deliver:use'],
      membershipRemainingDays: 30,
    });
  });

  it('查看公告时直接返回数据库原始链接', async () => {
    const { prisma } = createAccessPrismaMock();
    const service = createService(prisma);

    const result = await service.viewAnnouncement('user-1', 'job-1', {
      ip: '127.0.0.1',
      userAgent: 'vitest',
      deviceId: 'device-1',
      sessionId: 'session-1',
    });

    expect(result.announcementUrl).toBe('https://campus.acme.cn/jobs/1');
  });

  it('公告查看返回数据库源站直链', async () => {
    const { prisma } = createAccessPrismaMock();
    const service = createService(prisma);

    const result = await service.viewAnnouncement('user-1', 'job-1', {
      deviceId: 'device-1',
      sessionId: 'session-1',
    });
    expect(result.announcementUrl).toBe('https://campus.acme.cn/jobs/1');
  });

  it('投递链路直接返回数据库原始投递链接', async () => {
    const { prisma } = createAccessPrismaMock();
    prisma.$transaction = vi.fn().mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma));
    const service = createService(prisma);

    const deliverResult = await service.deliver('user-1', 'job-1', {
      deviceId: 'device-1',
      sessionId: 'session-1',
    });

    expect(deliverResult).not.toHaveProperty('recruitmentLink');
    expect(deliverResult).toMatchObject({
      action: 'open_link',
      deliveryType: 'website',
      deliveryUrl: 'https://apply.acme.cn/delivery/1',
      progressStatus: '已投递',
    });
  });

  it('免费专区查看公告不受会员权限限制', async () => {
    vi.mocked(assertUserHasMemberPermission).mockRejectedValueOnce(new ForbiddenException('标准会员及以上可查看招聘公告详情'));
    const { prisma } = createAccessPrismaMock();
    const service = createService(prisma);

    const result = await service.viewAnnouncement('user-1', 'job-1', {
      deviceId: 'device-1',
      sessionId: 'session-1',
    }, {
      bypassPermission: true,
    });

    expect(result.announcementUrl).toBe('https://campus.acme.cn/jobs/1');
  });

  it('免费专区立即投递不受会员权限限制', async () => {
    vi.mocked(assertUserHasMemberPermission).mockRejectedValueOnce(new ForbiddenException('标准会员及以上可使用立即投递'));
    const { prisma } = createAccessPrismaMock();
    prisma.$transaction = vi.fn().mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma));
    const service = createService(prisma);

    const result = await service.deliver('user-1', 'job-1', {
      deviceId: 'device-1',
      sessionId: 'session-1',
    }, {
      bypassPermission: true,
    });

    expect(result).toMatchObject({
      action: 'open_link',
      deliveryType: 'website',
      deliveryUrl: 'https://apply.acme.cn/delivery/1',
      progressStatus: '已投递',
    });
  });

  it('邮箱投递会直接返回邮箱地址而不是跳转链接', async () => {
    const { prisma } = createAccessPrismaMock();
    prisma.jobAnnouncement.findUnique = vi.fn().mockResolvedValue({
      id: 'job-1',
      status: 'published',
      announcementUrl: 'https://campus.acme.cn/jobs/1',
      deliveryUrl: 'hr@acme.cn',
      referralCode: null,
    });
    prisma.$transaction = vi.fn().mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma));
    const service = createService(prisma);

    const result = await service.deliver('user-1', 'job-1', {
      deviceId: 'device-1',
      sessionId: 'session-1',
    });

    expect(result).toMatchObject({
      action: 'show_email_modal',
      deliveryType: 'email',
      emailAddress: 'hr@acme.cn',
      progressStatus: '已投递',
    });
    expect(result).not.toHaveProperty('redirectPath');
  });

  it('已登录会员在共享 IP 被限制时仍可查看公告', async () => {
    const { prisma } = createAccessPrismaMock();
    const { service, redisService } = createServiceBundle(prisma);
    redisService.get.mockImplementation(async (key: string) => (
      key === 'jobs:risk:control:restrict:ip:127.0.0.1'
        ? JSON.stringify({ reason: '检测到多账号共用同一 IP 高频访问' })
        : null
    ));

    const result = await service.viewAnnouncement('user-1', 'job-1', {
      ip: '127.0.0.1',
      userAgent: 'vitest',
      deviceId: 'device-1',
      sessionId: 'session-1',
    });

    expect(result.announcementUrl).toBe('https://campus.acme.cn/jobs/1');
  });

  it('已登录会员在共享设备被冻结时仍可打开投递入口', async () => {
    const { prisma } = createAccessPrismaMock();
    prisma.$transaction = vi.fn().mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma));
    const { service, redisService } = createServiceBundle(prisma);
    redisService.get.mockImplementation(async (key: string) => (
      key === 'jobs:freeze:device:device-1'
        ? JSON.stringify({ reason: '检测到多账号共用同一设备高频访问' })
        : null
    ));

    const result = await service.deliver('user-1', 'job-1', {
      ip: '127.0.0.1',
      userAgent: 'vitest',
      deviceId: 'device-1',
      sessionId: 'session-1',
    });

    expect(result).toMatchObject({
      action: 'open_link',
      deliveryType: 'website',
      deliveryUrl: 'https://apply.acme.cn/delivery/1',
      progressStatus: '已投递',
    });
  });

  it('超级会员命中账号级 restrict 时仍可继续查看公告', async () => {
    const { prisma } = createAccessPrismaMock();
    const { service, redisService } = createServiceBundle(prisma);
    vi.mocked(assertUserHasMemberPermission).mockResolvedValueOnce({
      isMember: true,
      memberLevel: 'super',
      memberLevelLabel: '超级会员',
      memberRoleCode: 'SUPER_MEMBER',
      memberRoleName: '超级会员',
      permissionKeys: ['jobs:detail:view', 'jobs:deliver:use', 'jobs:referral:view', 'jobs:progress:update', 'jobs:recommend:view'],
      membershipRemainingDays: 30,
    });
    redisService.get.mockImplementation(async (key: string) => (
      key === 'jobs:risk:control:restrict:user:user-1'
        ? JSON.stringify({ reason: '短时间访问过多不同岗位，已进入临时限制查看' })
        : null
    ));

    const result = await service.viewAnnouncement('user-1', 'job-1', {
      ip: '127.0.0.1',
      userAgent: 'vitest',
      deviceId: 'device-1',
      sessionId: 'session-1',
    });

    expect(result.announcementUrl).toBe('https://campus.acme.cn/jobs/1');
  });
});
