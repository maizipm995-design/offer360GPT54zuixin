import { ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assertUserHasMemberPermission } from '../../../common/utils/member-access';
import { JobsService } from '../jobs.service';

vi.mock('../../../common/utils/member-access', () => ({
  assertUserHasMemberPermission: vi.fn(),
  getUserMemberAccess: vi.fn(),
}));

type AccessLogRecord = {
  jobId: string;
  userId: string | null;
  membershipId: string | null;
  memberLevel: string | null;
  action: string;
  requestStatus: string;
  accessTokenId: string | null;
  redirectTargetType: string | null;
  limitHit: boolean;
  riskHit: boolean;
  reviewStatus: string;
  failureReason: string | null;
  consumedAt: Date | null;
  expiresAt: Date | null;
  ip: string | null;
  userAgent: string | null;
  deviceId: string | null;
  sessionId: string | null;
};

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
  const accessLogs: AccessLogRecord[] = [];
  const trackingStore = new Map<string, { progressStatus: string }>();
  const job = {
    id: 'job-1',
    status: 'published',
    announcementUrl: 'https://campus.acme.cn/jobs/1',
    deliveryUrl: 'https://apply.acme.cn/delivery/1',
    referralCode: null,
  };

  return {
    accessLogs,
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
      jobAnnouncementAccessLog: {
        create: vi.fn().mockImplementation(async ({ data }: { data: AccessLogRecord }) => {
          accessLogs.push({ ...data });
          return data;
        }),
        findUnique: vi.fn().mockImplementation(async ({ where }: { where: { accessTokenId: string } }) => (
          accessLogs.find((item) => item.accessTokenId === where.accessTokenId) ?? null
        )),
        update: vi.fn().mockImplementation(async ({ where, data }: { where: { accessTokenId: string }; data: Partial<AccessLogRecord> }) => {
          const target = accessLogs.find((item) => item.accessTokenId === where.accessTokenId);
          if (!target) {
            throw new Error('access log not found');
          }
          Object.assign(target, data);
          return target;
        }),
      },
      $transaction: vi.fn().mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({})),
    },
  };
}

function createService(prisma: ReturnType<typeof createAccessPrismaMock>['prisma']) {
  const redisService = createRedisServiceMock();
  return new JobsService(
    prisma as never,
    new JwtService({ secret: 'unit-test-secret' }),
    {} as never,
    {
      recordAccessClick: vi.fn().mockResolvedValue(undefined),
      recordDeliveryMark: vi.fn().mockResolvedValue(undefined),
    } as never,
    {} as never,
    redisService as never,
  );
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

  it('查看公告时直接返回真实链接并写入 consumed 审计记录', async () => {
    const { prisma, accessLogs } = createAccessPrismaMock();
    const service = createService(prisma);

    const result = await service.viewAnnouncement('user-1', 'job-1', {
      ip: '127.0.0.1',
      userAgent: 'vitest',
      deviceId: 'device-1',
      sessionId: 'session-1',
    });

    expect(result).toMatchObject({
      announcementUrl: 'https://campus.acme.cn/jobs/1',
      redirectPath: 'https://campus.acme.cn/jobs/1',
    });
    expect(accessLogs).toHaveLength(1);
    expect(accessLogs[0]?.requestStatus).toBe('consumed');
    expect(accessLogs[0]?.userId).toBe('user-1');
    expect(accessLogs[0]?.membershipId).toBe('membership-1');
    expect(accessLogs[0]?.redirectTargetType).toBe('announcement');
    expect(accessLogs[0]?.consumedAt).toBeInstanceOf(Date);
  });

  it('公告查看返回真实链接且不附加追踪参数', async () => {
    const { prisma, accessLogs } = createAccessPrismaMock();
    const service = createService(prisma);

    const result = await service.viewAnnouncement('user-1', 'job-1', {
      deviceId: 'device-1',
      sessionId: 'session-1',
    });
    expect(result.announcementUrl).toBe('https://campus.acme.cn/jobs/1');
    expect(accessLogs[0]?.requestStatus).toBe('consumed');
  });

  it('投递链路恢复直接返回真实链接', async () => {
    const { prisma, accessLogs } = createAccessPrismaMock();
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
      redirectPath: 'https://apply.acme.cn/delivery/1',
      progressStatus: '已投递',
    });
    expect(accessLogs[0]?.requestStatus).toBe('consumed');
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

    expect(result).toMatchObject({
      announcementUrl: 'https://campus.acme.cn/jobs/1',
      redirectPath: 'https://campus.acme.cn/jobs/1',
    });
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
      redirectPath: 'https://apply.acme.cn/delivery/1',
      progressStatus: '已投递',
    });
  });

  it('邮箱投递会直接返回邮箱地址而不是跳转链接', async () => {
    const { prisma, accessLogs } = createAccessPrismaMock();
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
    expect(accessLogs[0]?.requestStatus).toBe('consumed');
    expect(accessLogs[0]?.redirectTargetType).toBe('email');
  });
});
