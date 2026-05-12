import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { getMembershipRemainingDays } from '../../common/utils/membership-time';
import { normalizeStoredMemberLevel, resolveMembershipState } from '../../common/utils/member-access';
import { PrismaService } from '../../prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { ADMIN_PERMISSION_CATALOG, ADMIN_PERMISSION_KEY_SET } from './admin-permissions';

interface PaginationInput {
  page: number;
  limit: number;
  skip: number;
}

@Injectable()
export class AdminGovernanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
  ) {}

  getPermissionCatalog() {
    return ADMIN_PERMISSION_CATALOG;
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
