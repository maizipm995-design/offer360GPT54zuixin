import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { RedisService } from '../../common/redis/redis.service';
import {
  getJobsRiskConfig,
  saveJobsRiskConfig,
} from '../../common/utils/jobs-risk-config';
import { getMembershipRemainingDays } from '../../common/utils/membership-time';
import { normalizeStoredMemberLevel, resolveMembershipState } from '../../common/utils/member-access';
import { PrismaService } from '../../prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { ADMIN_PERMISSION_CATALOG, ADMIN_PERMISSION_KEY_SET } from './admin-permissions';
import type { CurrentAdminPayload } from './decorators/current-admin.decorator';

const JOB_RISK_FREEZE_REGISTRY_KEY = 'jobs:freeze:registry';
const JOB_RISK_CONTROL_REGISTRY_KEY = 'jobs:risk:control:registry';
const JOB_RISK_REVIEW_STATUS = ['not_required', 'pending', 'processing', 'resolved', 'dismissed'] as const;

interface PaginationInput {
  page: number;
  limit: number;
  skip: number;
}

type JobAccessLogAdminDelegate = {
  findMany: (args: Record<string, unknown>) => Promise<Array<Record<string, any>>>;
  findUnique: (args: Record<string, unknown>) => Promise<Record<string, any> | null>;
  count: (args?: Record<string, unknown>) => Promise<number>;
  update: (args: Record<string, unknown>) => Promise<Record<string, any>>;
};
type JobsRiskFreezeScope = 'user' | 'ip' | 'device';
type JobsRiskControlType = 'cooldown' | 'restrict' | 'freeze';
type ParsedJobsRiskFreezePayload = {
  reason: string;
  createdAt?: string | null;
  source: 'automatic' | 'manual';
  ruleKey?: string | null;
  evidence?: string | null;
  level?: 1 | 2 | 3 | 4 | null;
  controlType?: JobsRiskControlType | null;
};

@Injectable()
export class AdminGovernanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly redisService: RedisService,
  ) {}

  private get jobAccessLogDelegate(): JobAccessLogAdminDelegate {
    return (this.prisma as PrismaService & { jobAnnouncementAccessLog: JobAccessLogAdminDelegate }).jobAnnouncementAccessLog;
  }

  getPermissionCatalog() {
    return ADMIN_PERMISSION_CATALOG;
  }

  async getJobsRiskConfig() {
    return getJobsRiskConfig(this.prisma, { forceRefresh: true });
  }

  async updateJobsRiskConfig(body: Record<string, unknown>) {
    const rawConfig = (body.config ?? body) as Record<string, unknown>;
    return saveJobsRiskConfig(this.prisma, rawConfig);
  }

  async getAdminUsers(query: Record<string, string | undefined>) {
    const pagination = this.getPagination(query);
    const keyword = query.keyword?.trim();
    const where: Prisma.AdminUserWhereInput = {};

    if (keyword) {
      where.OR = [
        { username: { contains: keyword } },
        { realName: { contains: keyword } },
        { phone: { contains: keyword } },
        { email: { contains: keyword } },
      ];
    }
    if (query.status) {
      where.status = query.status;
    }

    const [list, total] = await this.prisma.$transaction([
      this.prisma.adminUser.findMany({
        where,
        include: {
          userRoles: {
            include: {
              role: {
                include: { permissions: true },
              },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.adminUser.count({ where }),
    ]);

    return {
      list: list.map((item) => this.toAdminManagedUserItem(item)),
      pagination: this.toPagination(total, pagination),
    };
  }

  async createAdminUser(body: Record<string, unknown>) {
    const username = this.readRequiredString(body.username, '管理员账号不能为空');
    const password = this.readRequiredString(body.password, '管理员密码不能为空');
    const roleIds = this.readRequiredStringArray(body.roleIds, '至少选择一个角色');

    await this.ensureUniqueAdminFields({ username, phone: this.readOptionalString(body.phone), email: this.readOptionalString(body.email) });
    const roles = await this.getRolesByIds(roleIds);
    const passwordHash = await bcrypt.hash(password, 10);

    const created = await this.prisma.adminUser.create({
      data: {
        username,
        passwordHash,
        realName: this.readOptionalString(body.realName),
        phone: this.readOptionalString(body.phone) || undefined,
        email: this.readOptionalString(body.email) || undefined,
        status: this.readOptionalString(body.status) || 'active',
        remark: this.readOptionalString(body.remark),
        userRoles: {
          create: roles.map((role) => ({ roleId: role.id })),
        },
      },
      include: {
        userRoles: {
          include: {
            role: {
              include: { permissions: true },
            },
          },
        },
      },
    });

    return this.toAdminManagedUserItem(created);
  }

  async updateAdminUser(id: string, body: Record<string, unknown>, currentAdminId: string) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id },
      include: {
        userRoles: {
          include: {
            role: { include: { permissions: true } },
          },
        },
      },
    });
    if (!admin) {
      throw new NotFoundException('后台账号不存在');
    }

    const nextUsername = this.readOptionalString(body.username);
    const nextPhone = this.readOptionalString(body.phone);
    const nextEmail = this.readOptionalString(body.email);
    const nextStatus = this.readOptionalString(body.status);
    const nextRoleIds = body.roleIds !== undefined ? this.readRequiredStringArray(body.roleIds, '至少选择一个角色') : undefined;

    await this.ensureUniqueAdminFields({
      username: nextUsername && nextUsername !== admin.username ? nextUsername : undefined,
      phone: nextPhone !== undefined && nextPhone !== admin.phone ? nextPhone : undefined,
      email: nextEmail !== undefined && nextEmail !== admin.email ? nextEmail : undefined,
    });

    if (id === currentAdminId && nextStatus && nextStatus !== 'active') {
      throw new BadRequestException('不能停用当前登录账号');
    }

    const roles = nextRoleIds ? await this.getRolesByIds(nextRoleIds) : null;
    await this.ensureSuperAdminStillExists({
      adminId: id,
      nextStatus,
      nextRoleCodes: roles?.map((role) => role.code),
      currentRoleCodes: admin.userRoles.map((item) => item.role.code),
      currentAdminId,
    });

    const password = this.readOptionalString(body.password);
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.adminUser.update({
        where: { id },
        data: {
          username: nextUsername || undefined,
          realName: this.readOptionalString(body.realName),
          phone: nextPhone === '' ? null : nextPhone,
          email: nextEmail === '' ? null : nextEmail,
          status: nextStatus || undefined,
          remark: this.readOptionalString(body.remark),
          ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
        },
      });

      if (roles) {
        await tx.adminUserRole.deleteMany({ where: { adminUserId: id } });
        await tx.adminUserRole.createMany({
          data: roles.map((role) => ({ adminUserId: id, roleId: role.id })),
        });
      }

      return tx.adminUser.findUniqueOrThrow({
        where: { id },
        include: {
          userRoles: {
            include: {
              role: { include: { permissions: true } },
            },
          },
        },
      });
    });

    return this.toAdminManagedUserItem(updated);
  }

  async deleteAdminUser(id: string, currentAdminId: string) {
    if (id === currentAdminId) {
      throw new BadRequestException('不能删除当前登录账号');
    }

    const admin = await this.prisma.adminUser.findUnique({
      where: { id },
      include: { userRoles: { include: { role: true } } },
    });
    if (!admin) {
      throw new NotFoundException('后台账号不存在');
    }

    await this.ensureSuperAdminStillExists({
      adminId: id,
      nextStatus: 'deleted',
      nextRoleCodes: [],
      currentRoleCodes: admin.userRoles.map((item) => item.role.code),
      currentAdminId,
    });

    await this.prisma.adminUser.delete({ where: { id } });
    return { deleted: true };
  }

  async getAdminRoles(query: Record<string, string | undefined>) {
    const pagination = this.getPagination(query);
    const keyword = query.keyword?.trim();
    const where: Prisma.AdminRoleWhereInput = {};

    if (keyword) {
      where.OR = [
        { code: { contains: keyword } },
        { name: { contains: keyword } },
        { description: { contains: keyword } },
      ];
    }
    if (query.status) {
      where.status = query.status;
    }

    const [list, total] = await this.prisma.$transaction([
      this.prisma.adminRole.findMany({
        where,
        include: {
          permissions: true,
          _count: { select: { userRoles: true } },
        },
        orderBy: [{ createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.adminRole.count({ where }),
    ]);

    return {
      list: list.map((item) => this.toAdminManagedRoleItem(item)),
      pagination: this.toPagination(total, pagination),
    };
  }

  async createAdminRole(body: Record<string, unknown>) {
    const permissionKeys = this.readPermissionKeys(body.permissionKeys);
    const role = await this.prisma.adminRole.create({
      data: {
        code: this.normalizeRoleCode(this.readRequiredString(body.code, '角色编码不能为空')),
        name: this.readRequiredString(body.name, '角色名称不能为空'),
        description: this.readOptionalString(body.description),
        status: this.readOptionalString(body.status) || 'active',
        permissions: {
          create: permissionKeys.map((key) => {
            const permission = this.getPermissionByKey(key);
            return {
              permissionKey: permission.key,
              permissionName: permission.name,
              permissionGroup: permission.group,
              permissionType: 'api',
            };
          }),
        },
      },
      include: {
        permissions: true,
        _count: { select: { userRoles: true } },
      },
    });

    return this.toAdminManagedRoleItem(role);
  }

  async updateAdminRole(id: string, body: Record<string, unknown>) {
    const role = await this.prisma.adminRole.findUnique({ where: { id }, include: { permissions: true, _count: { select: { userRoles: true } } } });
    if (!role) {
      throw new NotFoundException('角色不存在');
    }
    if (role.code === 'super-admin' && this.readOptionalString(body.status) && this.readOptionalString(body.status) !== 'active') {
      throw new BadRequestException('超级管理员角色不能停用');
    }

    const permissionKeys = body.permissionKeys !== undefined ? this.readPermissionKeys(body.permissionKeys) : role.permissions.map((item) => item.permissionKey);
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.adminRole.update({
        where: { id },
        data: {
          code: this.normalizeRoleCode(this.readOptionalString(body.code) || role.code),
          name: this.readOptionalString(body.name) || role.name,
          description: this.readOptionalString(body.description),
          status: this.readOptionalString(body.status) || role.status,
        },
      });

      await tx.adminRolePermission.deleteMany({ where: { roleId: id } });
      if (permissionKeys.length) {
        await tx.adminRolePermission.createMany({
          data: permissionKeys.map((key) => {
            const permission = this.getPermissionByKey(key);
            return {
              roleId: id,
              permissionKey: permission.key,
              permissionName: permission.name,
              permissionGroup: permission.group,
              permissionType: 'api',
            };
          }),
        });
      }

      return tx.adminRole.findUniqueOrThrow({
        where: { id },
        include: { permissions: true, _count: { select: { userRoles: true } } },
      });
    });

    return this.toAdminManagedRoleItem(updated);
  }

  async deleteAdminRole(id: string) {
    const role = await this.prisma.adminRole.findUnique({ where: { id }, include: { _count: { select: { userRoles: true } } } });
    if (!role) {
      throw new NotFoundException('角色不存在');
    }
    if (role.code === 'super-admin') {
      throw new BadRequestException('超级管理员角色不允许删除');
    }
    if (role._count.userRoles > 0) {
      throw new BadRequestException('该角色仍有后台账号在使用，请先解除绑定');
    }

    await this.prisma.adminRole.delete({ where: { id } });
    return { deleted: true };
  }

  async getOperationLogs(query: Record<string, string | undefined>) {
    const pagination = this.getPagination(query);
    const keyword = query.keyword?.trim();
    const where: Prisma.AdminOperationLogWhereInput = {};

    if (keyword) {
      where.OR = [
        { module: { contains: keyword } },
        { action: { contains: keyword } },
        { targetType: { contains: keyword } },
        { targetId: { contains: keyword } },
        { requestPath: { contains: keyword } },
        { responseSummary: { contains: keyword } },
        { adminUser: { is: { username: { contains: keyword } } } },
        { adminUser: { is: { realName: { contains: keyword } } } },
      ];
    }
    if (query.module) {
      where.module = query.module;
    }
    if (query.action) {
      where.action = query.action;
    }
    if (query.adminUserId) {
      where.adminUserId = query.adminUserId;
    }

    const [list, total] = await this.prisma.$transaction([
      this.prisma.adminOperationLog.findMany({
        where,
        include: {
          adminUser: {
            select: {
              id: true,
              username: true,
              realName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.adminOperationLog.count({ where }),
    ]);

    return {
      list: list.map((item) => ({
        id: item.id.toString(),
        adminUserId: item.adminUserId,
        adminUsername: item.adminUser?.username || '',
        adminRealName: item.adminUser?.realName || '',
        module: item.module,
        action: item.action,
        targetType: item.targetType,
        targetId: item.targetId,
        requestMethod: item.requestMethod,
        requestPath: item.requestPath,
        requestPayload: item.requestPayload,
        responseSummary: item.responseSummary,
        ip: item.ip,
        userAgent: item.userAgent,
        createdAt: item.createdAt,
      })),
      pagination: this.toPagination(total, pagination),
    };
  }

  async getJobsRiskControls(query: Record<string, string | undefined>) {
    const pagination = this.getPagination(query);
    const keyword = query.keyword?.trim();
    const where: Record<string, unknown> = {};
    const and: Array<Record<string, unknown>> = [];

    if (keyword) {
      and.push({
        OR: [
          { jobId: { contains: keyword } },
          { userId: { contains: keyword } },
          { accessTokenId: { contains: keyword } },
          { failureReason: { contains: keyword } },
          { ip: { contains: keyword } },
          { deviceId: { contains: keyword } },
          { sessionId: { contains: keyword } },
          { user: { is: { phone: { contains: keyword } } } },
        ],
      });
    }
    if (query.action) {
      and.push({ action: query.action });
    }
    if (query.requestStatus) {
      and.push({ requestStatus: query.requestStatus });
    }
    if (query.userId) {
      and.push({ userId: query.userId });
    }
    if (query.limitHit === 'true') {
      and.push({ limitHit: true });
    }
    if (query.riskHit === 'true') {
      and.push({ riskHit: true });
    }
    if (query.reviewStatus && JOB_RISK_REVIEW_STATUS.includes(query.reviewStatus as (typeof JOB_RISK_REVIEW_STATUS)[number])) {
      and.push({ reviewStatus: query.reviewStatus });
    }
    if (query.scope === 'user') {
      and.push({ userId: { not: null } });
    }
    if (query.scope === 'ip') {
      and.push({ ip: { not: null } });
    }
    if (query.scope === 'device') {
      and.push({ deviceId: { not: null } });
    }
    if (query.riskLevel) {
      const riskLevel = this.readOptionalNumber(query.riskLevel, 0);
      if ([1, 2, 3, 4].includes(riskLevel)) {
        and.push(this.buildJobsRiskLevelWhere(riskLevel as 1 | 2 | 3 | 4));
      }
    }
    if (query.frozenOnly === 'true') {
      and.push({
        OR: [
          { riskHit: true },
          { requestStatus: 'denied' },
        ],
      });
    }

    if (and.length === 1) {
      Object.assign(where, and[0]);
    } else if (and.length > 1) {
      where.AND = and;
    }

    const activeControls = await this.getActiveJobsRiskControls();
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [list, total, totalLast24h, deniedLast24h, limitLast24h, riskLast24h, pendingReviewCount, processingReviewCount] = await Promise.all([
      this.jobAccessLogDelegate.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              phone: true,
            },
          },
          reviewedByAdminUser: {
            select: {
              id: true,
              realName: true,
              username: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.jobAccessLogDelegate.count({ where }),
      this.jobAccessLogDelegate.count({ where: { createdAt: { gte: last24Hours } } }),
      this.jobAccessLogDelegate.count({ where: { createdAt: { gte: last24Hours }, requestStatus: 'denied' } }),
      this.jobAccessLogDelegate.count({ where: { createdAt: { gte: last24Hours }, limitHit: true } }),
      this.jobAccessLogDelegate.count({ where: { createdAt: { gte: last24Hours }, riskHit: true } }),
      this.jobAccessLogDelegate.count({ where: { reviewStatus: 'pending' } }),
      this.jobAccessLogDelegate.count({ where: { reviewStatus: 'processing' } }),
    ]);

    return {
      summary: {
        totalLast24h,
        deniedLast24h,
        limitLast24h,
        riskLast24h,
        activeFreezeCount: activeControls.filter((item) => item.controlType === 'freeze').length,
        activeControlCount: activeControls.length,
        pendingReviewCount,
        processingReviewCount,
      },
      activeFreezes: activeControls.filter((item) => item.controlType === 'freeze'),
      activeControls,
      list: list.map((item: Record<string, any>) => this.toJobsRiskLogItem(item, activeControls)),
      pagination: this.toPagination(total, pagination),
    };
  }

  async getJobsRiskControlDetail(id: string) {
    const accessLogId = this.readBigIntId(id, '风控记录不存在');
    const activeControls = await this.getActiveJobsRiskControls();
    const detail = await this.jobAccessLogDelegate.findUnique({
      where: { id: accessLogId },
      include: {
        user: {
          select: {
            id: true,
            phone: true,
          },
        },
        reviewedByAdminUser: {
          select: {
            id: true,
            realName: true,
            username: true,
          },
        },
      },
    });

    if (!detail) {
      throw new NotFoundException('风控记录不存在');
    }

    const relatedOr = [
      detail.userId ? { userId: detail.userId } : undefined,
      detail.ip ? { ip: detail.ip } : undefined,
      detail.deviceId ? { deviceId: detail.deviceId } : undefined,
    ].filter(Boolean) as Array<Record<string, unknown>>;
    const relatedWhere: Record<string, unknown> = relatedOr.length ? { OR: relatedOr } : { id: accessLogId };
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [relatedLogs, sameUserLast24h, sameIpLast24h, sameDeviceLast24h, recentScopeRows] = await Promise.all([
      this.jobAccessLogDelegate.findMany({
        where: relatedWhere,
        include: {
          user: { select: { id: true, phone: true } },
          reviewedByAdminUser: { select: { id: true, realName: true, username: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
      detail.userId ? this.jobAccessLogDelegate.count({ where: { userId: detail.userId, createdAt: { gte: last24Hours } } }) : 0,
      detail.ip ? this.jobAccessLogDelegate.count({ where: { ip: detail.ip, createdAt: { gte: last24Hours } } }) : 0,
      detail.deviceId ? this.jobAccessLogDelegate.count({ where: { deviceId: detail.deviceId, createdAt: { gte: last24Hours } } }) : 0,
      this.jobAccessLogDelegate.findMany({
        where: relatedOr.length ? { AND: [relatedWhere, { createdAt: { gte: last24Hours } }] } : { id: accessLogId },
        select: {
          userId: true,
          ip: true,
          deviceId: true,
          failureReason: true,
        },
        take: 200,
      }),
    ]);

    const relatedControls = activeControls.filter((item) =>
      (item.scope === 'user' && item.identifier === detail.userId)
      || (item.scope === 'ip' && item.identifier === detail.ip)
      || (item.scope === 'device' && item.identifier === detail.deviceId));

    return {
      item: this.toJobsRiskLogItem(detail as Record<string, any>, activeControls),
      activeFreezes: relatedControls.filter((item) => item.controlType === 'freeze'),
      activeControls: relatedControls,
      relatedLogs: relatedLogs.map((item) => this.toJobsRiskLogItem(item as Record<string, any>, activeControls)),
      signals: {
        sameUserLast24h,
        sameIpLast24h,
        sameDeviceLast24h,
        distinctIpsForUserLast24h: detail.userId ? new Set(recentScopeRows.map((item) => item.ip).filter(Boolean)).size : 0,
        distinctUsersForIpLast24h: detail.ip ? new Set(recentScopeRows.map((item) => item.userId).filter(Boolean)).size : 0,
        distinctUsersForDeviceLast24h: detail.deviceId ? new Set(recentScopeRows.map((item) => item.userId).filter(Boolean)).size : 0,
        recentRiskReasons: Array.from(new Set(
          recentScopeRows
            .map((item) => this.resolveJobsRiskReasonCategory(item.failureReason))
            .filter((item) => item !== 'other'),
        )),
      },
    };
  }

  async reviewJobsRiskControl(id: string, body: Record<string, unknown>, currentAdmin: CurrentAdminPayload) {
    const accessLogId = this.readBigIntId(id, '风控记录不存在');
    const reviewStatus = this.readRequiredString(body.reviewStatus, '审核状态不能为空');
    if (!JOB_RISK_REVIEW_STATUS.includes(reviewStatus as (typeof JOB_RISK_REVIEW_STATUS)[number])) {
      throw new BadRequestException('审核状态不合法');
    }

    const updated = await this.jobAccessLogDelegate.update({
      where: { id: accessLogId },
      data: {
        reviewStatus,
        reviewConclusion: this.readOptionalString(body.reviewConclusion) || null,
        reviewNote: this.readOptionalString(body.reviewNote) || null,
        reviewedByAdminUserId: currentAdmin.adminId,
        reviewedAt: new Date(),
      },
      include: {
        user: { select: { id: true, phone: true } },
        reviewedByAdminUser: { select: { id: true, realName: true, username: true } },
      },
    });

    const activeControls = await this.getActiveJobsRiskControls();
    return this.toJobsRiskLogItem(updated as Record<string, any>, activeControls);
  }

  async batchReviewJobsRiskControls(body: Record<string, unknown>, currentAdmin: CurrentAdminPayload) {
    const logIds = this.readStringArray(body.logIds);
    if (!logIds.length) {
      throw new BadRequestException('请至少选择一条风控记录');
    }
    const reviewStatus = this.readRequiredString(body.reviewStatus, '审核状态不能为空');
    if (!JOB_RISK_REVIEW_STATUS.includes(reviewStatus as (typeof JOB_RISK_REVIEW_STATUS)[number])) {
      throw new BadRequestException('审核状态不合法');
    }
    const accessLogIds = Array.from(new Set(logIds.map((item) => this.readBigIntId(item, '风控记录不存在'))));

    const updated = await this.prisma.jobAnnouncementAccessLog.updateMany({
      where: { id: { in: accessLogIds } },
      data: {
        reviewStatus,
        reviewConclusion: this.readOptionalString(body.reviewConclusion) || null,
        reviewNote: this.readOptionalString(body.reviewNote) || null,
        reviewedByAdminUserId: currentAdmin.adminId,
        reviewedAt: new Date(),
      },
    });

    return {
      updatedCount: updated.count,
      logIds: accessLogIds.map((item) => item.toString()),
      reviewStatus,
    };
  }

  async freezeJobsRiskControl(body: Record<string, unknown>, currentAdmin: CurrentAdminPayload) {
    const scope = this.readRequiredString(body.scope, '冻结范围不能为空');
    if (!['user', 'ip', 'device'].includes(scope)) {
      throw new BadRequestException('冻结范围不合法');
    }
    const identifier = this.readRequiredString(body.identifier, '冻结标识不能为空');
    const reason = this.readRequiredString(body.reason, '冻结原因不能为空');
    const durationSeconds = Math.min(Math.max(this.readOptionalNumber(body.durationSeconds, 3600), 300), 7 * 24 * 60 * 60);

    await this.setJobsRiskFreeze(scope as JobsRiskFreezeScope, identifier, {
      reason,
      createdAt: new Date().toISOString(),
      source: 'manual',
      ruleKey: 'manual_review',
      evidence: `admin:${currentAdmin.adminId}`,
      level: 4,
      controlType: 'freeze',
    }, durationSeconds);

    const logIdText = this.readOptionalString(body.logId);
    if (logIdText) {
      const accessLogId = this.readBigIntId(logIdText, '风控记录不存在');
      await this.jobAccessLogDelegate.update({
        where: { id: accessLogId },
        data: {
          reviewStatus: 'resolved',
          reviewConclusion: `manual_freeze_${scope}`,
          reviewNote: this.readOptionalString(body.reviewNote) || reason,
          reviewedByAdminUserId: currentAdmin.adminId,
          reviewedAt: new Date(),
        },
      });
    }

    return {
      frozen: true,
      scope,
      identifier,
      durationSeconds,
      reason,
    };
  }

  async unfreezeJobsRiskControl(body: Record<string, unknown>) {
    const scope = this.readRequiredString(body.scope, '冻结范围不能为空');
    if (!['user', 'ip', 'device'].includes(scope)) {
      throw new BadRequestException('冻结范围不合法');
    }
    const identifier = this.readRequiredString(body.identifier, '冻结标识不能为空');
    const controlType = this.readJobsRiskControlType(body.controlType);
    const controlKey = controlType === 'freeze'
      ? this.buildJobsFreezeKey(scope as JobsRiskFreezeScope, identifier)
      : this.buildJobsRiskControlKey(controlType as Exclude<JobsRiskControlType, 'freeze'>, scope as JobsRiskFreezeScope, identifier);
    await this.redisService.del(controlKey);
    await this.redisService.srem(controlType === 'freeze' ? JOB_RISK_FREEZE_REGISTRY_KEY : JOB_RISK_CONTROL_REGISTRY_KEY, controlKey);
    return {
      unfrozen: true,
      scope,
      identifier,
      controlType,
    };
  }

  async batchUnfreezeJobsRiskControls(body: Record<string, unknown>) {
    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (!rawItems.length) {
      throw new BadRequestException('请至少选择一个处置对象');
    }

    const normalizedItems = Array.from(new Map(rawItems.map((rawItem) => {
      const item = rawItem as Record<string, unknown>;
      const scope = this.readRequiredString(item.scope, '处置范围不能为空');
      if (!['user', 'ip', 'device'].includes(scope)) {
        throw new BadRequestException('处置范围不合法');
      }
      const identifier = this.readRequiredString(item.identifier, '处置标识不能为空');
      const controlType = this.readJobsRiskControlType(item.controlType);
      return [`${controlType}:${scope}:${identifier}`, { scope, identifier, controlType }];
    })).values());

    await Promise.all(normalizedItems.map(async (item) => {
      const controlKey = item.controlType === 'freeze'
        ? this.buildJobsFreezeKey(item.scope as JobsRiskFreezeScope, item.identifier)
        : this.buildJobsRiskControlKey(item.controlType as Exclude<JobsRiskControlType, 'freeze'>, item.scope as JobsRiskFreezeScope, item.identifier);
      await this.redisService.del(controlKey);
      await this.redisService.srem(item.controlType === 'freeze' ? JOB_RISK_FREEZE_REGISTRY_KEY : JOB_RISK_CONTROL_REGISTRY_KEY, controlKey);
    }));

    return {
      unfrozenCount: normalizedItems.length,
      items: normalizedItems,
    };
  }

  async updateOrderStatus(id: string, body: Record<string, unknown>) {
    const nextStatus = this.readRequiredString(body.payStatus, '支付状态不能为空');
    if (!['paid', 'closed', 'refunded'].includes(nextStatus)) {
      throw new BadRequestException('支付状态不合法');
    }

    const order = await this.prisma.serviceOrder.findUnique({
      where: { id },
      include: {
        user: true,
        product: true,
        commissions: true,
      },
    });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    if (order.payStatus === 'refunded' && nextStatus !== 'refunded') {
      throw new BadRequestException('已退款订单不支持直接改回其他状态');
    }
    if (nextStatus === 'closed' && order.payStatus === 'paid') {
      throw new BadRequestException('已支付订单不能直接关闭，请使用退款流程');
    }
    if (nextStatus === 'refunded' && order.payStatus !== 'paid') {
      throw new BadRequestException('只有已支付订单才能发起退款');
    }

    const refundReason = this.readOptionalString(body.refundReason);
    const remark = this.readOptionalString(body.remark);

    if (nextStatus !== order.payStatus) {
      if (nextStatus === 'paid') {
        await this.paymentsService.markOrderPaidFromAdmin(id, remark);
      } else if (nextStatus === 'closed') {
        await this.paymentsService.closeOrderFromAdmin(id, remark);
      } else {
        await this.paymentsService.refundOrderFromAdmin(id, refundReason, remark);
      }
    }

    const result = await this.prisma.serviceOrder.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, phone: true, myInviteCode: true } },
        product: { select: { id: true, name: true } },
      },
    });
    if (!result) {
      throw new NotFoundException('订单不存在');
    }

    return {
      id: result.id,
      orderNo: result.orderNo,
      amount: Number(result.amount),
      payStatus: result.payStatus,
      payTime: result.payTime,
      refundReason: result.refundReason,
      refundAt: result.refundAt,
      remark: result.remark,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      user: result.user,
      product: result.product,
    };
  }

  async reconcileOrder(id: string) {
    return this.paymentsService.reconcileOrderFromAdmin(id);
  }

  async reconcileRecentOrders(body: Record<string, unknown>) {
    const limit = this.readOptionalNumber(body.limit, 20);
    const lookbackHours = this.readOptionalNumber(body.lookbackHours, 48);
    return this.paymentsService.reconcileRecentOrdersFromAdmin({
      limit,
      lookbackHours,
    });
  }

  async updateUserStatus(id: string, body: Record<string, unknown>) {
    const status = this.readRequiredString(body.status, '用户状态不能为空');
    if (!['active', 'inactive'].includes(status)) {
      throw new BadRequestException('用户状态不合法');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status },
      include: {
        profile: true,
        preference: true,
        membership: true,
        wallet: true,
        inviter: { select: { id: true, phone: true, myInviteCode: true } },
      },
    });

    return {
      status: updated.status,
      user: this.toFrontendUserItem(updated),
    };
  }

  async resetUserPassword(id: string, body: Record<string, unknown>) {
    const newPassword = this.readRequiredString(body.newPassword, '新密码不能为空');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
    return { updated: true };
  }

  private async ensureCommissionForPaidOrder(tx: Prisma.TransactionClient, orderId: string) {
    const order = await tx.serviceOrder.findUnique({
      where: { id: orderId },
      include: { user: true, product: true, commissions: true },
    });
    if (!order || !order.user.parentUid) {
      return;
    }
    if (order.commissions.some((item) => item.logType === 1)) {
      return;
    }

    const config = await tx.commissionConfig.findFirst({ orderBy: { id: 'asc' } });
    const rate = config?.oneLevelRate ?? 15;
    const commissionMoney = (Number(order.amount) * rate) / 100;

    await tx.commissionLog.create({
      data: {
        orderId: order.id,
        inviterUid: order.user.parentUid,
        consumeUid: order.user.id,
        commissionRate: rate,
        commissionMoney,
        originalConsumeMoney: order.amount,
        logType: 1,
      },
    });

    await tx.userWallet.upsert({
      where: { userId: order.user.parentUid },
      update: {
        availableBalance: { increment: commissionMoney },
        totalEarn: { increment: commissionMoney },
      },
      create: {
        userId: order.user.parentUid,
        availableBalance: commissionMoney,
        frozenBalance: 0,
        totalEarn: commissionMoney,
      },
    });
  }

  private async rollbackCommissionForRefund(tx: Prisma.TransactionClient, orderId: string) {
    const order = await tx.serviceOrder.findUnique({
      where: { id: orderId },
      include: {
        commissions: true,
      },
    });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    const originalLog = order.commissions.find((item) => item.logType === 1);
    const refundLog = order.commissions.find((item) => item.logType === 2);

    if (!originalLog || refundLog) {
      return;
    }

    await tx.commissionLog.create({
      data: {
        orderId,
        inviterUid: originalLog.inviterUid,
        consumeUid: originalLog.consumeUid,
        commissionRate: originalLog.commissionRate,
        commissionMoney: originalLog.commissionMoney,
        originalConsumeMoney: originalLog.originalConsumeMoney,
        logType: 2,
      },
    });

    const wallet = await tx.userWallet.findUnique({ where: { userId: originalLog.inviterUid } });
    if (!wallet) {
      return;
    }

    const availableBalance = Math.max(Number(wallet.availableBalance) - Number(originalLog.commissionMoney), 0);
    const totalEarn = Math.max(Number(wallet.totalEarn) - Number(originalLog.commissionMoney), 0);

    await tx.userWallet.update({
      where: { userId: originalLog.inviterUid },
      data: {
        availableBalance,
        totalEarn,
      },
    });
  }

  private toAdminManagedUserItem(item: Prisma.AdminUserGetPayload<{
    include: {
      userRoles: {
        include: {
          role: {
            include: { permissions: true };
          };
        };
      };
    };
  }>) {
    const roles = item.userRoles.map((relation) => relation.role);
    const permissions = Array.from(new Set(roles.flatMap((role) => role.permissions.map((permission) => permission.permissionKey))));
    return {
      id: item.id,
      username: item.username,
      realName: item.realName,
      phone: item.phone,
      email: item.email,
      status: item.status,
      remark: item.remark,
      lastLoginAt: item.lastLoginAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      isSuperAdmin: roles.some((role) => role.code === 'super-admin'),
      roleIds: roles.map((role) => role.id),
      roles: roles.map((role) => ({ id: role.id, code: role.code, name: role.name })),
      permissions,
    };
  }

  private toAdminManagedRoleItem(item: Prisma.AdminRoleGetPayload<{
    include: { permissions: true; _count: { select: { userRoles: true } } };
  }>) {
    return {
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      userCount: item._count.userRoles,
      permissionKeys: item.permissions.map((permission) => permission.permissionKey),
      permissions: item.permissions.map((permission) => ({
        id: permission.id,
        key: permission.permissionKey,
        name: permission.permissionName,
        group: permission.permissionGroup,
      })),
    };
  }

  private toFrontendUserItem(item: Prisma.UserGetPayload<{
    include: {
      profile: true;
      preference: true;
      membership: true;
      wallet: true;
      inviter: { select: { id: true; phone: true; myInviteCode: true } };
    };
  }>) {
    return {
      id: item.id,
      phone: item.phone,
      inviteCode: item.myInviteCode,
      parentUid: item.parentUid,
      parentPhone: item.inviter?.phone ?? '',
      parentInviteCode: item.inviter?.myInviteCode ?? '',
      createdAt: item.createdAt,
      lastLoginAt: item.lastLoginAt,
      status: item.status,
      sourceType: item.sourceType,
      profile: item.profile,
      preference: {
        intentionCity: this.toStringArray(item.preference?.intentionCity),
        intentionJob: this.toStringArray(item.preference?.intentionJob),
        intentionCompany: this.toStringArray(item.preference?.intentionCompany),
      },
      membership: item.membership
        ? {
            id: item.membership.id,
            memberLevel: resolveMembershipState(item.membership).activeLevel
              ?? normalizeStoredMemberLevel(item.membership.memberLevel)
              ?? 'standard',
            startAt: resolveMembershipState(item.membership).activeStartAt ?? item.membership.startAt,
            endAt: resolveMembershipState(item.membership).activeEndAt ?? item.membership.endAt,
            remainingDays: resolveMembershipState(item.membership).isMember
              ? resolveMembershipState(item.membership).remainingDays
              : getMembershipRemainingDays(item.membership.endAt),
            isActive: resolveMembershipState(item.membership).isMember,
          }
        : null,
      wallet: item.wallet
        ? {
            availableBalance: Number(item.wallet.availableBalance),
            frozenBalance: Number(item.wallet.frozenBalance),
            totalEarn: Number(item.wallet.totalEarn),
          }
        : null,
    };
  }

  private getPagination(query: Record<string, string | undefined>): PaginationInput {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
    return {
      page,
      limit,
      skip: (page - 1) * limit,
    };
  }

  private toPagination(total: number, pagination: PaginationInput) {
    return {
      page: pagination.page,
      limit: pagination.limit,
      total,
      hasMore: pagination.page * pagination.limit < total,
    };
  }

  private readRequiredString(value: unknown, message: string) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(message);
    }
    return value.trim();
  }

  private readOptionalString(value: unknown) {
    if (value === undefined) return undefined;
    if (value === null) return '';
    return String(value).trim();
  }

  private readOptionalNumber(value: unknown, fallback: number) {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private readBigIntId(value: string, message: string) {
    if (!/^\d+$/.test(value.trim())) {
      throw new NotFoundException(message);
    }
    return BigInt(value.trim());
  }

  private readJobsRiskControlType(value: unknown): JobsRiskControlType {
    const controlType = this.readOptionalString(value) || 'freeze';
    if (!['cooldown', 'restrict', 'freeze'].includes(controlType)) {
      throw new BadRequestException('处置类型不合法');
    }
    return controlType as JobsRiskControlType;
  }

  private toJobsRiskLogItem(item: Record<string, any>, activeControls: Array<Record<string, any>>) {
    const riskProfile = this.resolveJobsRiskProfile({
      reason: item.failureReason,
      limitHit: Boolean(item.limitHit),
      riskHit: Boolean(item.riskHit),
    });
    const matchedControls = activeControls.filter((control: Record<string, any>) =>
      (item.userId && control.scope === 'user' && control.identifier === item.userId)
      || (item.ip && control.scope === 'ip' && control.identifier === item.ip)
      || (item.deviceId && control.scope === 'device' && control.identifier === item.deviceId));
    return {
      id: item.id.toString(),
      jobId: item.jobId,
      userId: item.userId,
      userPhone: item.user?.phone ?? '',
      membershipId: item.membershipId,
      memberLevel: item.memberLevel,
      action: item.action,
      requestStatus: item.requestStatus,
      accessTokenId: item.accessTokenId,
      redirectTargetType: item.redirectTargetType,
      limitHit: item.limitHit,
      riskHit: item.riskHit,
      reviewStatus: item.reviewStatus ?? 'not_required',
      reviewConclusion: item.reviewConclusion ?? null,
      reviewNote: item.reviewNote ?? null,
      reviewedAt: item.reviewedAt ?? null,
      reviewedByAdminName: item.reviewedByAdminUser?.realName || item.reviewedByAdminUser?.username || '',
      riskReasonCategory: riskProfile.reasonCategory,
      riskLevel: riskProfile.level,
      riskLevelLabel: riskProfile.levelLabel,
      riskDispositionType: riskProfile.dispositionType,
      riskDispositionLabel: riskProfile.dispositionLabel,
      riskDispositionSummary: riskProfile.summary,
      ip: item.ip,
      userAgent: item.userAgent,
      deviceId: item.deviceId,
      sessionId: item.sessionId,
      failureReason: item.failureReason,
      consumedAt: item.consumedAt,
      expiresAt: item.expiresAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      activeFreezeScopes: matchedControls
        .filter((control: Record<string, any>) => control.controlType === 'freeze')
        .map((control: Record<string, any>) => control.scope),
      activeControls: matchedControls.map((control: Record<string, any>) => ({
        key: control.key,
        scope: control.scope,
        identifier: control.identifier,
        controlType: control.controlType,
        controlLabel: this.resolveJobsRiskControlLabel(control.controlType),
        level: control.level ?? riskProfile.level,
        levelLabel: this.resolveJobsRiskLevelLabel((control.level ?? riskProfile.level) as 1 | 2 | 3 | 4),
        reason: control.reason,
        ttlSeconds: control.ttlSeconds,
      })),
    };
  }

  private resolveJobsRiskProfile(input: { reason?: string | null; limitHit: boolean; riskHit: boolean }) {
    const text = input.reason?.trim() || '';
    const reasonCategory = this.resolveJobsRiskReasonCategory(text);
    if (text.includes('命中多个异常规则') || text.includes('人工审核')) {
      return {
        level: 4 as const,
        levelLabel: this.resolveJobsRiskLevelLabel(4),
        dispositionType: 'freeze' as const,
        dispositionLabel: this.resolveJobsRiskControlLabel('freeze'),
        summary: '四级异常，升级人工审核并执行高风险冻结',
        reasonCategory,
      };
    }
    if (['user_ip_rotation', 'shared_ip_users', 'shared_device_users', 'night_burst'].includes(reasonCategory)) {
      return {
        level: 3 as const,
        levelLabel: this.resolveJobsRiskLevelLabel(3),
        dispositionType: 'freeze' as const,
        dispositionLabel: this.resolveJobsRiskControlLabel('freeze'),
        summary: '三级异常，自动冻结账号 / IP / 设备并等待复核',
        reasonCategory,
      };
    }
    if (['job_enumeration', 'distinct_job_burst'].includes(reasonCategory) || text.includes('限制查看') || text.includes('额度已达上限')) {
      return {
        level: 2 as const,
        levelLabel: this.resolveJobsRiskLevelLabel(2),
        dispositionType: 'restrict' as const,
        dispositionLabel: this.resolveJobsRiskControlLabel('restrict'),
        summary: '二级异常，限制查看并进入待审核队列',
        reasonCategory,
      };
    }
    if (reasonCategory === 'page_scan' || input.limitHit || text.includes('冷却')) {
      return {
        level: 1 as const,
        levelLabel: this.resolveJobsRiskLevelLabel(1),
        dispositionType: 'cooldown' as const,
        dispositionLabel: this.resolveJobsRiskControlLabel('cooldown'),
        summary: '一级异常，触发限速冷却并继续观察',
        reasonCategory,
      };
    }
    return {
      level: input.riskHit ? (2 as const) : (1 as const),
      levelLabel: this.resolveJobsRiskLevelLabel(input.riskHit ? 2 : 1),
      dispositionType: input.riskHit ? ('restrict' as const) : ('cooldown' as const),
      dispositionLabel: this.resolveJobsRiskControlLabel(input.riskHit ? 'restrict' : 'cooldown'),
      summary: input.riskHit ? '异常已触发自动处置，建议人工复核' : '轻度异常，建议继续观察',
      reasonCategory,
    };
  }

  private resolveJobsRiskReasonCategory(reason?: string | null) {
    const text = reason?.trim() || '';
    if (!text) return 'other';
    if (text.includes('规律性翻页')) return 'page_scan';
    if (text.includes('顺序枚举岗位 ID')) return 'job_enumeration';
    if (text.includes('轮换多个 IP')) return 'user_ip_rotation';
    if (text.includes('多账号共用同一 IP')) return 'shared_ip_users';
    if (text.includes('多账号共用同一设备')) return 'shared_device_users';
    if (text.includes('深夜')) return 'night_burst';
    if (text.includes('不同岗位')) return 'distinct_job_burst';
    return 'other';
  }

  private resolveJobsRiskLevelLabel(level: 1 | 2 | 3 | 4) {
    return ['一级异常', '二级异常', '三级异常', '四级异常'][level - 1];
  }

  private resolveJobsRiskControlLabel(controlType: JobsRiskControlType) {
    if (controlType === 'freeze') return '冻结';
    if (controlType === 'restrict') return '限制查看';
    return '冷却观察';
  }

  private buildJobsRiskLevelWhere(level: 1 | 2 | 3 | 4) {
    if (level === 1) {
      return {
        OR: [
          { limitHit: true },
          { failureReason: { contains: '规律性翻页' } },
          { failureReason: { contains: '冷却' } },
        ],
      };
    }
    if (level === 2) {
      return {
        OR: [
          { failureReason: { contains: '顺序枚举岗位 ID' } },
          { failureReason: { contains: '不同岗位' } },
          { failureReason: { contains: '限制查看' } },
          { failureReason: { contains: '额度已达上限' } },
        ],
      };
    }
    if (level === 3) {
      return {
        OR: [
          { failureReason: { contains: '轮换多个 IP' } },
          { failureReason: { contains: '多账号共用同一 IP' } },
          { failureReason: { contains: '多账号共用同一设备' } },
          { failureReason: { contains: '深夜' } },
        ],
      };
    }
    return {
      OR: [
        { failureReason: { contains: '命中多个异常规则' } },
        { failureReason: { contains: '四级高风险' } },
      ],
    };
  }

  private async getActiveJobsRiskControls() {
    const [freezeKeys, controlKeys] = await Promise.all([
      this.redisService.smembers(JOB_RISK_FREEZE_REGISTRY_KEY),
      this.redisService.smembers(JOB_RISK_CONTROL_REGISTRY_KEY),
    ]);
    const allKeys = Array.from(new Set([...freezeKeys, ...controlKeys]));
    if (!allKeys.length) {
      return [];
    }

    const [reasons, ttlList] = await Promise.all([
      this.redisService.mget(...allKeys),
      Promise.all(allKeys.map((key) => this.redisService.ttl(key))),
    ]);

    const staleKeys: string[] = [];
    const activeList = allKeys.flatMap((key, index) => {
      const rawValue = reasons[index];
      const ttlSeconds = ttlList[index];
      const parsed = this.parseJobsFreezeKey(key);
      if (!rawValue || ttlSeconds <= 0 || !parsed) {
        staleKeys.push(key);
        return [];
      }
      const payload = this.parseJobsFreezePayload(rawValue);
      return [{
        key,
        scope: parsed.scope,
        identifier: parsed.identifier,
        controlType: parsed.controlType,
        reason: payload.reason,
        source: payload.source,
        ruleKey: payload.ruleKey ?? null,
        evidence: payload.evidence ?? null,
        createdAt: payload.createdAt ?? null,
        level: payload.level ?? (parsed.controlType === 'freeze' ? 3 : parsed.controlType === 'restrict' ? 2 : 1),
        ttlSeconds,
      }];
    });

    if (staleKeys.length) {
      const freezeStaleKeys = staleKeys.filter((key) => key.startsWith('jobs:freeze:'));
      const controlStaleKeys = staleKeys.filter((key) => key.startsWith('jobs:risk:control:'));
      if (freezeStaleKeys.length) {
        await this.redisService.srem(JOB_RISK_FREEZE_REGISTRY_KEY, ...freezeStaleKeys);
      }
      if (controlStaleKeys.length) {
        await this.redisService.srem(JOB_RISK_CONTROL_REGISTRY_KEY, ...controlStaleKeys);
      }
    }

    return activeList.sort((a, b) => a.level - b.level || a.ttlSeconds - b.ttlSeconds);
  }

  private buildJobsFreezeKey(scope: 'user' | 'ip' | 'device', identifier: string) {
    return `jobs:freeze:${scope}:${identifier}`;
  }

  private buildJobsRiskControlKey(controlType: Exclude<JobsRiskControlType, 'freeze'>, scope: 'user' | 'ip' | 'device', identifier: string) {
    return `jobs:risk:control:${controlType}:${scope}:${identifier}`;
  }

  private parseJobsFreezePayload(rawValue: string): ParsedJobsRiskFreezePayload {
    try {
      const parsed = JSON.parse(rawValue) as Partial<ParsedJobsRiskFreezePayload>;
      return {
        reason: typeof parsed.reason === 'string' && parsed.reason.trim() ? parsed.reason.trim() : rawValue,
        createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : null,
        source: parsed.source === 'manual' ? 'manual' : 'automatic',
        ruleKey: typeof parsed.ruleKey === 'string' ? parsed.ruleKey : null,
        evidence: typeof parsed.evidence === 'string' ? parsed.evidence : null,
        level: [1, 2, 3, 4].includes(Number(parsed.level)) ? Number(parsed.level) as 1 | 2 | 3 | 4 : null,
        controlType: parsed.controlType === 'freeze' || parsed.controlType === 'restrict' || parsed.controlType === 'cooldown'
          ? parsed.controlType
          : null,
      };
    } catch {
      return {
        reason: rawValue,
        createdAt: null,
        source: 'automatic',
        ruleKey: null,
        evidence: null,
        level: null,
        controlType: null,
      };
    }
  }

  private async setJobsRiskFreeze(
    scope: JobsRiskFreezeScope,
    identifier: string,
    payload: ParsedJobsRiskFreezePayload,
    durationSeconds: number,
  ) {
    const freezeKey = this.buildJobsFreezeKey(scope, identifier);
    await this.redisService.set(freezeKey, JSON.stringify(payload), durationSeconds);
    await this.redisService.sadd(JOB_RISK_FREEZE_REGISTRY_KEY, freezeKey);
  }

  private parseJobsFreezeKey(key: string): { scope: JobsRiskFreezeScope; identifier: string; controlType: JobsRiskControlType } | null {
    const freezeMatched = key.match(/^jobs:freeze:(user|ip|device):(.+)$/);
    if (freezeMatched) {
      return {
        scope: freezeMatched[1] as JobsRiskFreezeScope,
        identifier: freezeMatched[2],
        controlType: 'freeze',
      };
    }
    const controlMatched = key.match(/^jobs:risk:control:(cooldown|restrict):(user|ip|device):(.+)$/);
    if (!controlMatched) {
      return null;
    }
    return {
      controlType: controlMatched[1] as JobsRiskControlType,
      scope: controlMatched[2] as JobsRiskFreezeScope,
      identifier: controlMatched[3],
    };
  }

  private readRequiredStringArray(value: unknown, message: string) {
    const items = this.readStringArray(value);
    if (!items.length) {
      throw new BadRequestException(message);
    }
    return items;
  }

  private readStringArray(value: unknown) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }
    if (typeof value === 'string') {
      return value.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean);
    }
    return [];
  }

  private toStringArray(value: unknown) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item));
    }
    return [];
  }

  private readPermissionKeys(value: unknown) {
    const keys = this.readStringArray(value);
    const invalidKeys = keys.filter((key) => !ADMIN_PERMISSION_KEY_SET.has(key));
    if (invalidKeys.length) {
      throw new BadRequestException(`存在无效权限：${invalidKeys.join('、')}`);
    }
    return Array.from(new Set(keys));
  }

  private async getRolesByIds(roleIds: string[]) {
    const roles = await this.prisma.adminRole.findMany({
      where: { id: { in: roleIds }, status: 'active' },
    });
    if (roles.length !== Array.from(new Set(roleIds)).length) {
      throw new BadRequestException('所选角色不存在或已停用');
    }
    return roles;
  }

  private getPermissionByKey(key: string) {
    const permission = ADMIN_PERMISSION_CATALOG.find((item) => item.key === key);
    if (!permission) {
      throw new BadRequestException(`权限 ${key} 不存在`);
    }
    return permission;
  }

  private normalizeRoleCode(value: string) {
    return value.trim().toLowerCase();
  }

  private async ensureUniqueAdminFields(input: { username?: string; phone?: string | undefined; email?: string | undefined }) {
    if (input.username) {
      const existing = await this.prisma.adminUser.findUnique({ where: { username: input.username } });
      if (existing) {
        throw new BadRequestException('管理员账号已存在');
      }
    }
    if (input.phone) {
      const existing = await this.prisma.adminUser.findUnique({ where: { phone: input.phone } });
      if (existing) {
        throw new BadRequestException('管理员手机号已存在');
      }
    }
    if (input.email) {
      const existing = await this.prisma.adminUser.findUnique({ where: { email: input.email } });
      if (existing) {
        throw new BadRequestException('管理员邮箱已存在');
      }
    }
  }

  private async ensureSuperAdminStillExists(input: {
    adminId: string;
    nextStatus?: string;
    nextRoleCodes?: string[];
    currentRoleCodes: string[];
    currentAdminId: string;
  }) {
    const currentlySuperAdmin = input.currentRoleCodes.includes('super-admin');
    const nextStillSuperAdmin = input.nextRoleCodes ? input.nextRoleCodes.includes('super-admin') : currentlySuperAdmin;
    const nextStillActive = input.nextStatus ? input.nextStatus === 'active' : true;

    if (!currentlySuperAdmin || (nextStillSuperAdmin && nextStillActive)) {
      return;
    }

    const activeSuperAdminCount = await this.prisma.adminUser.count({
      where: {
        id: { not: input.adminId },
        status: 'active',
        userRoles: {
          some: {
            role: { code: 'super-admin', status: 'active' },
          },
        },
      },
    });

    if (activeSuperAdminCount < 1) {
      throw new BadRequestException('系统至少需要保留一个启用中的超级管理员账号');
    }

    if (input.adminId === input.currentAdminId && (!nextStillSuperAdmin || !nextStillActive)) {
      throw new BadRequestException('不能移除当前登录账号的超级管理员能力');
    }
  }
}
