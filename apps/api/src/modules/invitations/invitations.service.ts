import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma.service';

const milestones = [3, 5, 8];
const INVITE_TRACE_EXPIRE_DAYS = 7;

@Injectable()
export class InvitationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(userId: string) {
    const [user, invitees, redirectLink, rewardLogs] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, include: { wallet: true } }),
      this.prisma.user.findMany({
        where: { parentUid: userId },
        select: { id: true, phone: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.ensureRedirectLink(userId),
      this.prisma.inviteRewardLog.findMany({
        where: { inviterUid: userId },
        orderBy: { milestone: 'asc' },
      }),
    ]);

    const inviteCount = invitees.length;
    const reachedMilestones = rewardLogs.length;
    const nextMilestone = milestones.find((item) => item > inviteCount) ?? null;

    return {
      inviteCode: user?.myInviteCode,
      shareText: `我在用 offer360 找校招工作，全网校招信息一键聚合，还有内推资源！你也来看看吧，登录链接为【${redirectLink ? `https://offer360.cn/invite/${redirectLink.randomKey}` : 'https://offer360.cn'}】`,
      rules: [
        '累计邀请满 3 人，额外赠送标准会员 10 天',
        '累计邀请满 5 人，在原有奖励基础上再加赠标准会员 15 天',
        '累计邀请满 8 人，再加赠标准会员 30 天',
        '邀请奖励自动发放，无需手动领取',
        '邀请关系由系统静默绑定，不影响好友正常注册流程',
        '激励金仅限站内下单抵扣使用，永久不可提现',
      ],
      stats: {
        inviteCount,
        nextMilestone,
        rewardedTimes: reachedMilestones,
        distanceToNext: nextMilestone ? Math.max(nextMilestone - inviteCount, 0) : 0,
        wallet: user?.wallet
          ? {
              availableBalance: Number(user.wallet.availableBalance),
              totalEarn: Number(user.wallet.totalEarn),
            }
          : null,
      },
      progress: {
        current: inviteCount,
        target: nextMilestone ?? milestones[milestones.length - 1],
        text: nextMilestone
          ? `距离下一个奖励还需邀请 ${Math.max(nextMilestone - inviteCount, 0)} 人`
          : '已解锁全部邀请奖励',
      },
      records: invitees.map((item, index) => ({
        id: item.id,
        registerTime: item.createdAt,
        rewardStatus: index < reachedMilestones ? '奖励已发放' : '待达成里程碑',
        maskedPhone: item.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
      })),
    };
  }

  async getLanding(randomKey: string, options?: { ip?: string | null; userAgent?: string | null }) {
    const link = await this.prisma.invRedirectLink.findUnique({
      where: { randomKey },
      include: {
        inviter: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!link || (link.expireAt && link.expireAt <= new Date())) {
      throw new NotFoundException('邀请链接不存在或已失效');
    }

    await this.prisma.invVisitorTrace.create({
      data: {
        traceSn: this.generateTraceSn(),
        inviterUid: link.inviterUid,
        ip: options?.ip || undefined,
        userAgent: options?.userAgent || undefined,
        clickAt: new Date(),
        expireAt: new Date(Date.now() + INVITE_TRACE_EXPIRE_DAYS * 24 * 60 * 60 * 1000),
      },
    });

    const inviteCount = await this.prisma.user.count({ where: { parentUid: link.inviterUid } });
    const inviterName = this.resolveInviterName(link.inviter);

    return {
      randomKey: link.randomKey,
      inviteCode: link.inviter.myInviteCode,
      inviter: {
        id: link.inviter.id,
        name: inviterName,
        maskedPhone: this.maskPhone(link.inviter.phone),
      },
      inviteStats: {
        inviteCount,
      },
      heroTitle: `${inviterName} 邀请你一起使用 offer360`,
      heroDescription: '校招岗位聚合、求职服务、会员权益和邀请增长能力已打通，注册后即可绑定邀请关系并继续体验完整链路。',
      benefits: ['注册即建立邀请关系', '后续下单可进入激励金结算链路', '个人中心可查看奖励进度与邀请记录'],
    };
  }

  private async ensureRedirectLink(userId: string) {
    const existing = await this.prisma.invRedirectLink.findFirst({ where: { inviterUid: userId }, orderBy: { id: 'asc' } });
    if (existing) {
      return existing;
    }

    return this.prisma.invRedirectLink.create({
      data: {
        inviterUid: userId,
        randomKey: await this.generateUniqueRandomKey(),
      },
    });
  }

  private async generateUniqueRandomKey() {
    for (let index = 0; index < 10; index += 1) {
      const candidate = `INV${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
      const existing = await this.prisma.invRedirectLink.findUnique({ where: { randomKey: candidate } });
      if (!existing) {
        return candidate;
      }
    }
    return `INV${Date.now().toString(36).toUpperCase()}`;
  }

  private generateTraceSn() {
    return `TRACE${randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase()}`;
  }

  private resolveInviterName(inviter: User & { profile?: { name?: string | null } | null }) {
    return inviter.profile?.name?.trim() || this.maskPhone(inviter.phone);
  }

  private maskPhone(phone: string) {
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  }
}
