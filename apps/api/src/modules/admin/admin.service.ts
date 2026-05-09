import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import {
  buildMemberAccessSnapshot,
  getMemberLevelLabel,
  getMemberRoleName,
  getMemberRolePermissionMaps,
  MEMBER_PERMISSION_CATALOG,
  MEMBER_ROLE_DEFINITIONS,
  normalizeStoredMemberLevel,
  parseMemberLevelInput,
  type MemberLevel,
  type MemberPermissionKey,
  type MemberRoleCode,
} from '../../common/utils/member-access';
import { getMembershipRemainingDays, isMembershipActive } from '../../common/utils/membership-time';
import { normalizeJobTextDate, parseJobTextDate } from '../../common/utils/job-text-date';
import { PrismaService } from '../../prisma.service';
import { ensureJobsRecommendationConfig } from '../jobs/jobs-recommendation-config';
import { JobsNormalizationService } from '../jobs/jobs-normalization.service';
import { clearAllJobsRecommendationCache, invalidateJobsRecommendationCacheByUserId } from '../jobs/jobs-recommendation-cache';
import {
  GLOBAL_VERTICAL_SPACING_TEMPLATE_CODE,
  GLOBAL_VERTICAL_SPACING_TEMPLATE_DESCRIPTION,
  GLOBAL_VERTICAL_SPACING_TEMPLATE_NAME,
  getDefaultResumeTemplateConfig,
  getResumeTemplateConfigsBundle,
  normalizeResumeStyleJson,
  normalizeResumeVerticalSpacing,
  toGlobalVerticalSpacingStyleJsonValue,
  toStoredResumeTemplateStyleJsonValue,
} from '../resume/resume-template-config';
import { StorageService } from '../storage/storage.service';
import {
  CAREER_JOURNEY_CONTENT_HTML,
  CAREER_JOURNEY_CONTENT_SLUG,
  CAREER_JOURNEY_CONTENT_TITLE,
} from '../memberships/career-journey-content';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

interface PaginationInput {
  page: number;
  limit: number;
  skip: number;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly normalizationService: JobsNormalizationService,
    private readonly storageService: StorageService,
  ) {}

  async getOverview() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - DAY_IN_MS * 7);
    const thirtyDaysAgo = new Date(now.getTime() - DAY_IN_MS * 30);

    const [
      jobTotal,
      jobsSevenDays,
      jobsThirtyDays,
      userTotal,
      usersSevenDays,
      activeMembers,
      membershipContentCount,
      serviceProductCount,
      orderCount,
      orderAmount,
      commissionAmount,
      walletAmount,
      latestJobs,
      latestOrders,
      hotProducts,
    ] = await Promise.all([
      this.prisma.jobAnnouncement.count(),
      this.prisma.jobAnnouncement.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.jobAnnouncement.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.userMembership.count({ where: { endAt: { gt: now } } }),
      this.prisma.membershipRichTextContent.count(),
      this.prisma.serviceProduct.count(),
      this.prisma.serviceOrder.count(),
      this.prisma.serviceOrder.aggregate({ _sum: { amount: true } }),
      this.prisma.commissionLog.aggregate({ _sum: { commissionMoney: true } }),
      this.prisma.userWallet.aggregate({ _sum: { availableBalance: true } }),
      this.prisma.jobAnnouncement.findMany({
        take: 5,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          companyFullName: true,
          jobName: true,
          announcementTitle: true,
          workLocation: true,
          updatedAt: true,
        },
      }),
      this.prisma.serviceOrder.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { phone: true } },
          product: { select: { name: true } },
        },
      }),
      this.prisma.serviceProduct.findMany({
        take: 5,
        orderBy: [{ isHot: 'desc' }, { salesCount: 'desc' }, { updatedAt: 'desc' }],
      }),
    ]);

    return {
      summaryCards: [
        { label: '招聘公告总数', value: jobTotal, helper: `近7天新增 ${jobsSevenDays}` },
        { label: '近30天新增岗位', value: jobsThirtyDays, helper: '用于观察岗位更新频率' },
        { label: '注册用户总数', value: userTotal, helper: `近7天新增 ${usersSevenDays}` },
        { label: '有效会员数', value: activeMembers, helper: 'endAt 晚于当前时间' },
        { label: '会员权益内容数', value: membershipContentCount, helper: '可在后台富文本维护' },
        { label: '服务商品数', value: serviceProductCount, helper: '含上下架商品' },
        { label: '服务订单数', value: orderCount, helper: `订单总额 ${this.toCurrencyNumber(orderAmount._sum.amount)}` },
        { label: '累计分销金额', value: this.toCurrencyNumber(commissionAmount._sum.commissionMoney), helper: `钱包余额 ${this.toCurrencyNumber(walletAmount._sum.availableBalance)}` },
      ],
      latestJobs: latestJobs.map((item) => ({
        id: item.id,
        companyName: item.companyFullName,
        positionNames: item.jobName || item.announcementTitle || '',
        workLocation: item.workLocation,
        updatedAt: item.updatedAt,
      })),
      latestOrders: latestOrders.map((item) => ({
        id: item.id,
        orderNo: item.orderNo,
        amount: this.toNumber(item.amount),
        payStatus: item.payStatus,
        createdAt: item.createdAt,
        userPhone: item.user.phone,
        productName: item.product.name,
      })),
      hotProducts: hotProducts.map((item) => ({
        id: item.id,
        name: item.name,
        price: this.toNumber(item.price),
        salesCount: item.salesCount,
        isHot: item.isHot,
        status: item.status,
      })),
    };
  }

  async getJobs(query: Record<string, string | undefined>) {
    const pagination = this.getPagination(query);
    const where = this.buildJobsWhere(query);
    const [list, total] = await this.prisma.$transaction([
      this.prisma.jobAnnouncement.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.jobAnnouncement.count({ where }),
    ]);

    return {
      list: list.map((item) => this.toAdminJobItem(item)),
      pagination: this.toPagination(total, pagination),
    };
  }

  async createJob(body: Record<string, unknown>) {
    const item = await this.prisma.jobAnnouncement.create({
      data: this.buildJobCreateInput(body),
    });
    clearAllJobsRecommendationCache();
    return this.toAdminJobItem(item);
  }

  async updateJob(id: string, body: Record<string, unknown>) {
    await this.ensureJobExists(id);
    const item = await this.prisma.jobAnnouncement.update({
      where: { id },
      data: this.toJobUpdateInput(body),
    });
    clearAllJobsRecommendationCache();
    return this.toAdminJobItem(item);
  }

  async deleteJob(id: string) {
    await this.ensureJobExists(id);
    await this.prisma.jobAnnouncement.delete({ where: { id } });
    clearAllJobsRecommendationCache();
    return { deleted: true };
  }

  async getUsers(query: Record<string, string | undefined>) {
    const pagination = this.getPagination(query);
    const where = this.buildUsersWhere(query);
    const [list, total, permissionMaps] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          profile: true,
          preference: true,
          membership: true,
          wallet: true,
          inviter: { select: { id: true, phone: true, myInviteCode: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.user.count({ where }),
      getMemberRolePermissionMaps(this.prisma),
    ]);

    const now = new Date();

    return {
      list: list.map((item) => this.toAdminUserItem(item, permissionMaps.effectivePermissionMap, now)),
      pagination: this.toPagination(total, pagination),
    };
  }

  async createUser(body: Record<string, unknown>) {
    const phone = this.readRequiredString(body.phone, '手机号不能为空');
    const password = this.readRequiredString(body.password, '初始密码不能为空');
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing) {
      throw new BadRequestException('手机号已存在');
    }

    const parentUid = await this.resolveParentUid(body);
    const passwordHash = await bcrypt.hash(password, 10);
    const inviteCode = await this.generateInviteCode(phone);
    const [profileInput, preferenceInput] = await Promise.all([
      this.toUserProfileInput(body),
      this.toUserPreferenceInput(body),
    ]);

    const user = await this.prisma.user.create({
      data: {
        phone,
        passwordHash,
        myInviteCode: inviteCode,
        parentUid,
      },
    });

    if (profileInput) {
      await this.prisma.userProfile.create({
        data: {
          userId: user.id,
          ...profileInput,
        },
      });
    }

    if (preferenceInput) {
      await this.prisma.userJobPreferenceTag.create({
        data: {
          userId: user.id,
          ...preferenceInput,
        },
      });
    }

    const [createdUser, permissionMaps] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: user.id },
        include: {
          profile: true,
          preference: true,
          membership: true,
          wallet: true,
          inviter: { select: { id: true, phone: true, myInviteCode: true } },
        },
      }),
      getMemberRolePermissionMaps(this.prisma),
    ]);

    if (!createdUser) {
      throw new NotFoundException('用户不存在');
    }

    return this.toAdminUserItem(createdUser, permissionMaps.effectivePermissionMap);
  }

  async updateUser(id: string, body: Record<string, unknown>) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const phone = this.readOptionalString(body.phone);
    if (phone && phone !== user.phone) {
      const existing = await this.prisma.user.findUnique({ where: { phone } });
      if (existing && existing.id !== id) {
        throw new BadRequestException('手机号已存在');
      }
    }

    const updateUserData: Prisma.UserUncheckedUpdateInput = {};
    if (phone) updateUserData.phone = phone;
    const status = this.readOptionalString(body.status);
    if (status) updateUserData.status = status;
    const sourceType = this.readOptionalString(body.sourceType);
    if (sourceType) updateUserData.sourceType = sourceType;
    if (body.parentInviteCode !== undefined || body.parentUid !== undefined) {
      updateUserData.parentUid = await this.resolveParentUid(body);
    }
    const password = this.readOptionalString(body.password);
    if (password) {
      updateUserData.passwordHash = await bcrypt.hash(password, 10);
    }

    await this.prisma.user.update({
      where: { id },
      data: updateUserData,
    });

    const [profileInput, preferenceInput] = await Promise.all([
      this.toUserProfileInput(body),
      this.toUserPreferenceInput(body),
    ]);
    if (profileInput) {
      await this.prisma.userProfile.upsert({
        where: { userId: id },
        update: profileInput,
        create: { userId: id, ...profileInput },
      });
    }

    if (preferenceInput) {
      await this.prisma.userJobPreferenceTag.upsert({
        where: { userId: id },
        update: preferenceInput,
        create: { userId: id, ...preferenceInput },
      });
    }

    invalidateJobsRecommendationCacheByUserId(id);

    const [updatedUser, permissionMaps] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id },
        include: {
          profile: true,
          preference: true,
          membership: true,
          wallet: true,
          inviter: { select: { id: true, phone: true, myInviteCode: true } },
        },
      }),
      getMemberRolePermissionMaps(this.prisma),
    ]);

    if (!updatedUser) {
      throw new NotFoundException('用户不存在');
    }

    return this.toAdminUserItem(updatedUser, permissionMaps.effectivePermissionMap);
  }

  async deleteUser(id: string) {
    await this.ensureUserExists(id);
    invalidateJobsRecommendationCacheByUserId(id);
    await this.prisma.user.delete({ where: { id } });
    return { deleted: true };
  }

  async getMemberships(query: Record<string, string | undefined>) {
    const pagination = this.getPagination(query);
    const now = new Date();
    const where: Prisma.UserMembershipWhereInput = {};
    const keyword = query.keyword?.trim();
    if (keyword) {
      where.user = {
        is: {
          OR: [
            { phone: { contains: keyword } },
            { myInviteCode: { contains: keyword } },
          ],
        },
      };
    }
    if (query.status === 'active') {
      where.endAt = { gte: now };
    }
    if (query.status === 'expired') {
      where.endAt = { lt: now };
    }
    const memberLevel = this.readOptionalString(query.memberLevel);
    if (memberLevel) {
      where.memberLevel = parseMemberLevelInput(memberLevel);
    }

    const [list, total, permissionMaps] = await Promise.all([
      this.prisma.userMembership.findMany({
        where,
        include: {
          user: { select: { id: true, phone: true, myInviteCode: true } },
        },
        orderBy: { endAt: 'asc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.userMembership.count({ where }),
      getMemberRolePermissionMaps(this.prisma),
    ]);

    return {
      list: list.map((item) => this.toAdminMembershipItem(item, item.user.phone, item.user.myInviteCode, permissionMaps.effectivePermissionMap, now)),
      pagination: this.toPagination(total, pagination),
    };
  }

  async createMembership(body: Record<string, unknown>) {
    const user = await this.resolveMembershipUser(body);
    const days = this.readOptionalNumber(body.days) ?? 180;
    const memberLevel = parseMemberLevelInput(body.memberLevel, 'standard');
    const membership = await this.openMembership(user.id, days, memberLevel);
    invalidateJobsRecommendationCacheByUserId(user.id);
    const permissionMaps = await getMemberRolePermissionMaps(this.prisma);
    return this.toAdminMembershipItem(membership, user.phone, user.myInviteCode, permissionMaps.effectivePermissionMap);
  }

  async updateMembership(id: string, body: Record<string, unknown>) {
    const membership = await this.prisma.userMembership.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, phone: true, myInviteCode: true } },
      },
    });
    if (!membership) {
      throw new NotFoundException('会员记录不存在');
    }

    const days = this.readOptionalNumber(body.days);
    const nextMemberLevel = body.memberLevel === undefined
      ? normalizeStoredMemberLevel(membership.memberLevel) ?? 'standard'
      : parseMemberLevelInput(body.memberLevel, 'standard');

    if (days && body.startAt === undefined && body.endAt === undefined && body.remainingDays === undefined) {
      const renewed = await this.openMembership(membership.userId, days, nextMemberLevel);
      invalidateJobsRecommendationCacheByUserId(membership.userId);
      const permissionMaps = await getMemberRolePermissionMaps(this.prisma);
      return this.toAdminMembershipItem(renewed, membership.user.phone, membership.user.myInviteCode, permissionMaps.effectivePermissionMap);
    }

    const startAt = this.readOptionalDate(body.startAt) ?? membership.startAt;
    const endAt = this.readOptionalDate(body.endAt) ?? membership.endAt;
    const remainingDays = this.readOptionalNumber(body.remainingDays) ?? this.calculateRemainingDays(endAt);

    const updated = await this.prisma.userMembership.update({
      where: { id },
      data: {
        memberLevel: nextMemberLevel,
        startAt,
        endAt,
        remainingDays,
      },
    });
    invalidateJobsRecommendationCacheByUserId(membership.userId);
    const permissionMaps = await getMemberRolePermissionMaps(this.prisma);
    return this.toAdminMembershipItem(updated, membership.user.phone, membership.user.myInviteCode, permissionMaps.effectivePermissionMap);
  }

  async deleteMembership(id: string) {
    const membership = await this.prisma.userMembership.findUnique({ where: { id } });
    if (!membership) {
      throw new NotFoundException('会员记录不存在');
    }
    await this.prisma.userMembership.delete({ where: { id } });
    invalidateJobsRecommendationCacheByUserId(membership.userId);
    return { deleted: true };
  }

  async getMembershipContents(query: Record<string, string | undefined>) {
    const pagination = this.getPagination(query);
    const keyword = query.keyword?.trim();
    const where: Prisma.MembershipRichTextContentWhereInput = keyword
      ? {
          OR: [
            { slug: { contains: keyword } },
            { title: { contains: keyword } },
          ],
        }
      : {};

    if (query.status) {
      where.status = query.status;
    }

    const [list, total] = await this.prisma.$transaction([
      this.prisma.membershipRichTextContent.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.membershipRichTextContent.count({ where }),
    ]);

    return {
      list: await Promise.all(list.map((item) => this.hydrateRichTextContent(item))),
      pagination: this.toPagination(total, pagination),
    };
  }

  async createMembershipContent(body: Record<string, unknown>) {
    const saved = await this.prisma.membershipRichTextContent.create({
      data: {
        slug: this.readRequiredString(body.slug, 'slug 不能为空'),
        title: this.readRequiredString(body.title, '标题不能为空'),
        htmlContent: this.normalizeStoredHtml(body.htmlContent, '富文本内容不能为空'),
        status: this.readOptionalString(body.status) || 'published',
        version: this.readOptionalNumber(body.version) ?? 1,
        publishedAt: this.readOptionalDate(body.publishedAt) ?? new Date(),
      },
    });
    return this.hydrateRichTextContent(saved);
  }

  async updateMembershipContent(id: string, body: Record<string, unknown>) {
    await this.ensureMembershipContentExists(id);
    const version = this.readOptionalNumber(body.version);

    const saved = await this.prisma.membershipRichTextContent.update({
      where: { id },
      data: {
        slug: this.readRequiredString(body.slug, 'slug 不能为空'),
        title: this.readRequiredString(body.title, '标题不能为空'),
        htmlContent: this.normalizeStoredHtml(body.htmlContent, '富文本内容不能为空'),
        status: this.readOptionalString(body.status) || 'published',
        publishedAt: this.readOptionalDate(body.publishedAt) ?? new Date(),
        ...(version !== undefined ? { version } : { version: { increment: 1 } }),
      },
    });
    return this.hydrateRichTextContent(saved);
  }

  async deleteMembershipContent(id: string) {
    await this.ensureMembershipContentExists(id);
    await this.prisma.membershipRichTextContent.delete({ where: { id } });
    return { deleted: true };
  }

  async getCareerJourneyContent() {
    return this.hydrateRichTextContent(await this.ensureCareerJourneyContent());
  }

  async updateCareerJourneyContent(body: Record<string, unknown>) {
    const existing = await this.ensureCareerJourneyContent();
    const saved = await this.prisma.membershipRichTextContent.update({
      where: { id: existing.id },
      data: {
        slug: CAREER_JOURNEY_CONTENT_SLUG,
        title: CAREER_JOURNEY_CONTENT_TITLE,
        htmlContent: this.normalizeStoredHtml(body.htmlContent, '富文本内容不能为空'),
        status: 'published',
        publishedAt: new Date(),
        version: { increment: 1 },
      },
    });
    return this.hydrateRichTextContent(saved);
  }

  async getMemberPermissionCatalog() {
    return MEMBER_PERMISSION_CATALOG;
  }

  async getMemberRoles() {
    const now = new Date();
    const [roles, permissionMaps, userTotal, activeStandardCount, activeSuperCount] = await Promise.all([
      this.prisma.memberRole.findMany({
        include: {
          permissions: {
            orderBy: {
              permissionKey: 'asc',
            },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      getMemberRolePermissionMaps(this.prisma),
      this.prisma.user.count(),
      this.prisma.userMembership.count({ where: { endAt: { gte: now }, memberLevel: 'standard' } }),
      this.prisma.userMembership.count({ where: { endAt: { gte: now }, memberLevel: 'super' } }),
    ]);

    const roleMap = new Map(roles.map((item) => [item.code, item]));
    const freeUserCount = Math.max(userTotal - activeStandardCount - activeSuperCount, 0);

    return MEMBER_ROLE_DEFINITIONS.map((definition) => {
      const role = roleMap.get(definition.code);
      const directPermissionKeys = role?.permissions.map((permission) => permission.permissionKey as MemberPermissionKey) ?? definition.permissionKeys;
      const effectivePermissionKeys = permissionMaps.effectivePermissionMap[definition.code];
      return {
        id: role?.id || definition.code,
        code: definition.code,
        name: definition.name,
        description: role?.description || definition.description,
        status: role?.status || 'active',
        isSystem: role?.isSystem ?? true,
        sortOrder: role?.sortOrder ?? definition.sortOrder,
        inheritedRoleCode: definition.inheritedRoleCode || null,
        userCount:
          definition.code === 'FREE_USER'
            ? freeUserCount
            : definition.code === 'STANDARD_MEMBER'
              ? activeStandardCount
              : activeSuperCount,
        permissionKeys: directPermissionKeys,
        effectivePermissionKeys,
        permissions: effectivePermissionKeys.map((permissionKey) => {
          const meta = MEMBER_PERMISSION_CATALOG.find((item) => item.key === permissionKey)!;
          return {
            key: meta.key,
            name: meta.name,
            group: meta.group,
            description: meta.description,
            inherited: !directPermissionKeys.includes(permissionKey),
          };
        }),
        createdAt: role?.createdAt,
        updatedAt: role?.updatedAt,
      };
    });
  }

  async updateMemberRole(id: string, body: Record<string, unknown>) {
    const role = await this.prisma.memberRole.findUnique({
      where: { id },
      include: {
        permissions: true,
      },
    });
    if (!role) {
      throw new NotFoundException('会员角色不存在');
    }

    const definition = MEMBER_ROLE_DEFINITIONS.find((item) => item.code === role.code as MemberRoleCode);
    if (!definition) {
      throw new BadRequestException('仅支持维护系统内置会员角色');
    }

    const permissionKeys = this.readMemberPermissionKeys(body.permissionKeys);
    const description = this.readOptionalString(body.description) || role.description || definition.description;

    await this.prisma.$transaction(async (tx) => {
      await tx.memberRole.update({
        where: { id },
        data: {
          name: definition.name,
          code: definition.code,
          description,
          status: 'active',
          isSystem: true,
          sortOrder: definition.sortOrder,
        },
      });

      await tx.memberRolePermission.deleteMany({ where: { roleId: id } });
      if (permissionKeys.length) {
        await tx.memberRolePermission.createMany({
          data: permissionKeys.map((permissionKey) => {
            const meta = MEMBER_PERMISSION_CATALOG.find((item) => item.key === permissionKey)!;
            return {
              roleId: id,
              permissionKey,
              permissionName: meta.name,
              permissionGroup: meta.group,
              permissionType: 'member',
            };
          }),
        });
      }
    });

    const list = await this.getMemberRoles();
    const updated = list.find((item) => item.id === id);
    if (!updated) {
      throw new NotFoundException('会员角色不存在');
    }
    return updated;
  }

  async getServiceProducts(query: Record<string, string | undefined>) {
    const pagination = this.getPagination(query);
    const keyword = query.keyword?.trim();
    const where: Prisma.ServiceProductWhereInput = {};

    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { description: { contains: keyword } },
      ];
    }
    if (query.status === 'active') {
      where.status = true;
    }
    if (query.status === 'inactive') {
      where.status = false;
    }
    if (query.hot === 'hot') {
      where.isHot = true;
    }

    const [list, total] = await this.prisma.$transaction([
      this.prisma.serviceProduct.findMany({
        where,
        orderBy: [{ isHot: 'desc' }, { updatedAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.serviceProduct.count({ where }),
    ]);

    return {
      list: await Promise.all(list.map((item) => this.hydrateServiceProduct(item))),
      pagination: this.toPagination(total, pagination),
    };
  }

  async createServiceProduct(body: Record<string, unknown>) {
    const saved = await this.prisma.serviceProduct.create({
      data: this.toServiceProductInput(body),
    });
    return this.hydrateServiceProduct(saved);
  }

  async updateServiceProduct(id: string, body: Record<string, unknown>) {
    await this.ensureServiceProductExists(id);
    const saved = await this.prisma.serviceProduct.update({
      where: { id },
      data: this.toServiceProductInput(body),
    });
    return this.hydrateServiceProduct(saved);
  }

  async deleteServiceProduct(id: string) {
    await this.ensureServiceProductExists(id);
    const orderCount = await this.prisma.serviceOrder.count({ where: { productId: id } });
    if (orderCount > 0) {
      throw new BadRequestException('该服务商品已有订单，不可删除，请先下架');
    }
    await this.prisma.serviceProduct.delete({ where: { id } });
    return { deleted: true };
  }

  async getResumeTemplateConfigs() {
    const { templates, globalVerticalSpacing } = await getResumeTemplateConfigsBundle(this.prisma);
    return {
      templates: templates.map((item) => ({
        ...item,
        styleJson: normalizeResumeStyleJson(item.styleJson, {
          globalVerticalSpacing,
          ignoreSourceVerticalSpacing: true,
        }),
      })),
      globalVerticalSpacing,
    };
  }

  async updateResumeGlobalVerticalSpacing(body: Record<string, unknown>) {
    const nextVerticalSpacing = normalizeResumeVerticalSpacing(body.verticalSpacing);

    await this.prisma.resumeTemplateConfig.upsert({
      where: { templateCode: GLOBAL_VERTICAL_SPACING_TEMPLATE_CODE },
      update: {
        templateName: GLOBAL_VERTICAL_SPACING_TEMPLATE_NAME,
        description: GLOBAL_VERTICAL_SPACING_TEMPLATE_DESCRIPTION,
        styleJson: toGlobalVerticalSpacingStyleJsonValue(nextVerticalSpacing),
      },
      create: {
        templateCode: GLOBAL_VERTICAL_SPACING_TEMPLATE_CODE,
        templateName: GLOBAL_VERTICAL_SPACING_TEMPLATE_NAME,
        description: GLOBAL_VERTICAL_SPACING_TEMPLATE_DESCRIPTION,
        styleJson: toGlobalVerticalSpacingStyleJsonValue(nextVerticalSpacing),
      },
    });

    return nextVerticalSpacing;
  }

  async updateResumeTemplateConfig(templateCode: string, body: Record<string, unknown>) {
    const { globalVerticalSpacing } = await getResumeTemplateConfigsBundle(this.prisma);
    const defaultTemplate = getDefaultResumeTemplateConfig(templateCode);
    const nextTemplateName = this.readOptionalString(body.templateName) || defaultTemplate.templateName;
    const nextDescription = this.readNullableString(body.description) ?? defaultTemplate.description;
    const styleJsonPayload = this.readRecord(body.styleJson);
    const styleJson = normalizeResumeStyleJson({
      ...defaultTemplate.styleJson,
      ...styleJsonPayload,
      templateCode: defaultTemplate.templateCode,
    }, {
      globalVerticalSpacing,
      ignoreSourceVerticalSpacing: true,
    });

    const saved = await this.prisma.resumeTemplateConfig.upsert({
      where: { templateCode: defaultTemplate.templateCode },
      update: {
        templateName: nextTemplateName,
        description: nextDescription,
        styleJson: toStoredResumeTemplateStyleJsonValue(styleJson),
      },
      create: {
        templateCode: defaultTemplate.templateCode,
        templateName: nextTemplateName,
        description: nextDescription,
        styleJson: toStoredResumeTemplateStyleJsonValue(styleJson),
      },
    });

    return {
      ...saved,
      styleJson: normalizeResumeStyleJson(saved.styleJson, {
        globalVerticalSpacing,
        ignoreSourceVerticalSpacing: true,
      }),
    };
  }

  async getOrders(query: Record<string, string | undefined>) {
    const pagination = this.getPagination(query);
    const keyword = query.keyword?.trim();
    const where: Prisma.ServiceOrderWhereInput = {};
    if (keyword) {
      where.OR = [
        { orderNo: { contains: keyword } },
        { user: { is: { phone: { contains: keyword } } } },
        { product: { is: { name: { contains: keyword } } } },
      ];
    }
    if (query.payStatus) {
      where.payStatus = query.payStatus;
    }

    const [list, total, amount] = await this.prisma.$transaction([
      this.prisma.serviceOrder.findMany({
        where,
        include: {
          user: { select: { id: true, phone: true, myInviteCode: true } },
          product: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.serviceOrder.count({ where }),
      this.prisma.serviceOrder.aggregate({ where, _sum: { amount: true } }),
    ]);

    return {
      stats: {
        total,
        amount: this.toNumber(amount._sum.amount),
      },
      list: list.map((item) => ({
        id: item.id,
        orderNo: item.orderNo,
        amount: this.toNumber(item.amount),
        payStatus: item.payStatus,
        payTime: item.payTime,
        refundReason: item.refundReason,
        refundAt: item.refundAt,
        remark: item.remark,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        user: item.user,
        product: item.product,
      })),
      pagination: this.toPagination(total, pagination),
    };
  }

  async getCommissionLogs(query: Record<string, string | undefined>) {
    const pagination = this.getPagination(query);
    const keyword = query.keyword?.trim();
    const where: Prisma.CommissionLogWhereInput = {};
    if (keyword) {
      where.OR = [
        { order: { is: { orderNo: { contains: keyword } } } },
        { inviter: { is: { phone: { contains: keyword } } } },
        { consumer: { is: { phone: { contains: keyword } } } },
      ];
    }
    if (query.logType) {
      where.logType = Number(query.logType);
    }

    const [list, total, amount] = await this.prisma.$transaction([
      this.prisma.commissionLog.findMany({
        where,
        include: {
          order: { select: { orderNo: true } },
          inviter: { select: { id: true, phone: true } },
          consumer: { select: { id: true, phone: true } },
        },
        orderBy: { createAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.commissionLog.count({ where }),
      this.prisma.commissionLog.aggregate({ where, _sum: { commissionMoney: true } }),
    ]);

    return {
      stats: {
        total,
        amount: this.toNumber(amount._sum.commissionMoney),
      },
      list: list.map((item) => ({
        id: item.id,
        orderNo: item.order.orderNo,
        inviter: item.inviter,
        consumer: item.consumer,
        commissionRate: item.commissionRate,
        commissionMoney: this.toNumber(item.commissionMoney),
        originalConsumeMoney: this.toNumber(item.originalConsumeMoney),
        logType: item.logType,
        createAt: item.createAt,
      })),
      pagination: this.toPagination(total, pagination),
    };
  }

  async getJobsRecommendationConfig() {
    return ensureJobsRecommendationConfig(this.prisma);
  }

  async updateJobsRecommendationConfig(id: number, body: Record<string, unknown>) {
    const config = await ensureJobsRecommendationConfig(this.prisma);
    const targetId = Number.isFinite(id) && id > 0 ? id : config.id;

    return this.prisma.jobsRecommendationConfig.update({
      where: { id: targetId },
      data: {
        companyWeight: this.ensureMinNumber(this.readRequiredNumber(body.companyWeight, '意向公司权重不能为空'), 0, '意向公司权重不能小于 0'),
        jobWeight: this.ensureMinNumber(this.readRequiredNumber(body.jobWeight, '目标岗位权重不能为空'), 0, '目标岗位权重不能小于 0'),
        cityExactWeight: this.ensureMinNumber(this.readRequiredNumber(body.cityExactWeight, '精确城市权重不能为空'), 0, '精确城市权重不能小于 0'),
        cityParentWeight: this.ensureMinNumber(this.readRequiredNumber(body.cityParentWeight, '父级城市权重不能为空'), 0, '父级城市权重不能小于 0'),
        degreeWeight: this.ensureMinNumber(this.readRequiredNumber(body.degreeWeight, '学历权重不能为空'), 0, '学历权重不能小于 0'),
        majorWeight: this.ensureMinNumber(this.readRequiredNumber(body.majorWeight, '专业权重不能为空'), 0, '专业权重不能小于 0'),
        fresh3DaysWeight: this.ensureMinNumber(this.readRequiredNumber(body.fresh3DaysWeight, '近 3 天时效权重不能为空'), 0, '近 3 天时效权重不能小于 0'),
        fresh7DaysWeight: this.ensureMinNumber(this.readRequiredNumber(body.fresh7DaysWeight, '近 7 天时效权重不能为空'), 0, '近 7 天时效权重不能小于 0'),
        stateOwnedFallbackWeight: this.ensureMinNumber(this.readRequiredNumber(body.stateOwnedFallbackWeight, '精选兜底权重不能为空'), 0, '精选兜底权重不能小于 0'),
        deliveredPenalty: this.readRequiredNumber(body.deliveredPenalty, '已投递惩罚分不能为空'),
        heatMax: this.ensureMinNumber(this.readRequiredNumber(body.heatMax, '热度加分上限不能为空'), 0, '热度加分上限不能小于 0'),
        hotAccessThreshold: this.ensureMinNumber(this.readRequiredNumber(body.hotAccessThreshold, '点击热度阈值不能为空'), 1, '点击热度阈值必须大于等于 1'),
        hotDeliveryThreshold: this.ensureMinNumber(this.readRequiredNumber(body.hotDeliveryThreshold, '投递热度阈值不能为空'), 1, '投递热度阈值必须大于等于 1'),
      },
    });
  }

  async getCommissionConfig() {
    return this.ensureCommissionConfig();
  }

  async updateCommissionConfig(id: number, body: Record<string, unknown>) {
    const config = await this.ensureCommissionConfig();
    const targetId = Number.isFinite(id) && id > 0 ? id : config.id;
    return this.prisma.commissionConfig.update({
      where: { id: targetId },
      data: {
        oneLevelRate: this.readRequiredNumber(body.oneLevelRate, '一级分销比例不能为空'),
      },
    });
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

  private buildJobsWhere(query: Record<string, string | undefined>): Prisma.JobAnnouncementWhereInput {
    const keyword = query.keyword?.trim();
    const and: Prisma.JobAnnouncementWhereInput[] = [];

    if (keyword) {
      and.push({
        OR: [
          { companyFullName: { contains: keyword } },
          { jobName: { contains: keyword } },
          { jobCategory: { contains: keyword } },
          { workLocation: { contains: keyword } },
          { announcementTitle: { contains: keyword } },
          { industry: { contains: keyword } },
          { graduationSession: { contains: keyword } },
        ],
      });
    }
    if (query.enterpriseNature) {
      and.push({ enterpriseNature: query.enterpriseNature });
    }
    if (query.jobType) {
      and.push({ recruitmentType: query.jobType });
    }

    return and.length ? { AND: and } : {};
  }

  private buildUsersWhere(query: Record<string, string | undefined>): Prisma.UserWhereInput {
    const keyword = query.keyword?.trim();
    const now = new Date();
    const and: Prisma.UserWhereInput[] = [];

    if (keyword) {
      and.push({
        OR: [
          { phone: { contains: keyword } },
          { myInviteCode: { contains: keyword } },
          { profile: { is: { name: { contains: keyword } } } },
        ],
      });
    }

    if (query.membershipStatus === 'member') {
      and.push({ membership: { is: { endAt: { gte: now } } } });
    }
    if (query.membershipStatus === 'non-member') {
      and.push({
        OR: [
          { membership: { is: null } },
          { membership: { is: { endAt: { lt: now } } } },
        ],
      });
    }

    return and.length ? { AND: and } : {};
  }

  buildJobCreateInput(body: Record<string, unknown>): Prisma.JobAnnouncementCreateManyInput {
    const companyFullName = this.readRequiredString(
      this.readFirstDefined(body.companyFullName, body.companyName),
      '企业/单位全称不能为空',
    );
    const deadlineAt = this.readNullableJobTextDate(body.deadlineAt, '截止日期');
    const entryDatePayload = this.resolveJobEntryDatePayload(body.entryDate);

    const data: Prisma.JobAnnouncementCreateManyInput = {
      companyFullName,
      enterpriseNature: this.readNullableString(body.enterpriseNature) ?? null,
      degreeRequirement: this.readNullableString(body.degreeRequirement) ?? null,
      workLocation: this.readNullableString(body.workLocation) ?? null,
      jobName: this.readNullableString(this.readFirstDefined(body.jobName, body.positionNames)) ?? null,
      jobCategory: this.readNullableString(this.readFirstDefined(body.jobCategory, body.positionCategory)) ?? null,
      recruitmentType: this.readNullableString(this.readFirstDefined(body.recruitmentType, body.jobType)) ?? null,
      deadlineAt: deadlineAt ?? null,
      announcementUrl: this.readNullableString(body.announcementUrl) ?? null,
      deliveryUrl: this.readNullableString(this.readFirstDefined(body.deliveryUrl, body.recruitmentLink)) ?? null,
      graduationSession: this.readNullableString(this.readFirstDefined(body.graduationSession, body.majorRequirement)) ?? null,
      referralCode: this.readNullableString(body.referralCode) ?? null,
      announcementTitle: this.readNullableString(body.announcementTitle) ?? null,
      industry: this.readNullableString(body.industry) ?? null,
      entryDate: entryDatePayload.entryDate,
      createdAt: entryDatePayload.createdAt,
      updatedAt: entryDatePayload.createdAt, // 批量导入时：用录入日期覆盖更新时间，保证数据时间口径统一
      status: this.readOptionalString(body.status) || 'published',
    };

    return data;
  }

  private toJobUpdateInput(body: Record<string, unknown>): Prisma.JobAnnouncementUncheckedUpdateInput {
    const companyFullName = this.readRequiredString(
      this.readFirstDefined(body.companyFullName, body.companyName),
      '企业/单位全称不能为空',
    );
    const deadlineAt = this.readNullableJobTextDate(body.deadlineAt, '截止日期');
    const entryDate = this.readNullableJobTextDate(body.entryDate, '录入日期');
    const status = this.readOptionalString(body.status);

    return {
      companyFullName,
      enterpriseNature: this.readNullableString(body.enterpriseNature) ?? null,
      degreeRequirement: this.readNullableString(body.degreeRequirement) ?? null,
      workLocation: this.readNullableString(body.workLocation) ?? null,
      jobName: this.readNullableString(this.readFirstDefined(body.jobName, body.positionNames)) ?? null,
      jobCategory: this.readNullableString(this.readFirstDefined(body.jobCategory, body.positionCategory)) ?? null,
      recruitmentType: this.readNullableString(this.readFirstDefined(body.recruitmentType, body.jobType)) ?? null,
      ...(deadlineAt !== undefined ? { deadlineAt } : {}),
      announcementUrl: this.readNullableString(body.announcementUrl) ?? null,
      deliveryUrl: this.readNullableString(this.readFirstDefined(body.deliveryUrl, body.recruitmentLink)) ?? null,
      graduationSession: this.readNullableString(this.readFirstDefined(body.graduationSession, body.majorRequirement)) ?? null,
      referralCode: this.readNullableString(body.referralCode) ?? null,
      announcementTitle: this.readNullableString(body.announcementTitle) ?? null,
      industry: this.readNullableString(body.industry) ?? null,
      ...(entryDate !== undefined ? { entryDate } : {}),
      ...(status ? { status } : {}),
    };
  }

  private toAdminJobItem(item: Prisma.JobAnnouncementGetPayload<{}>) {
    return {
      id: item.id,
      companyFullName: item.companyFullName,
      enterpriseNature: item.enterpriseNature,
      degreeRequirement: item.degreeRequirement,
      workLocation: item.workLocation,
      jobName: item.jobName,
      jobCategory: item.jobCategory,
      recruitmentType: item.recruitmentType,
      deadlineAt: item.deadlineAt,
      announcementUrl: item.announcementUrl,
      deliveryUrl: item.deliveryUrl,
      graduationSession: item.graduationSession,
      referralCode: item.referralCode,
      announcementTitle: item.announcementTitle,
      industry: item.industry,
      entryDate: item.entryDate,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private toAdminUserItem(
    item: Prisma.UserGetPayload<{
      include: {
        profile: true;
        preference: true;
        membership: true;
        wallet: true;
        inviter: { select: { id: true; phone: true; myInviteCode: true } };
      };
    }>,
    effectivePermissionMap: Record<MemberRoleCode, MemberPermissionKey[]>,
    now: Date = new Date(),
  ) {
    const access = buildMemberAccessSnapshot(item.membership, effectivePermissionMap, now);

    return {
      id: item.id,
      phone: item.phone,
      status: item.status,
      sourceType: item.sourceType,
      inviteCode: item.myInviteCode,
      parentUid: item.parentUid,
      parentPhone: item.inviter?.phone ?? '',
      parentInviteCode: item.inviter?.myInviteCode ?? '',
      createdAt: item.createdAt,
      lastLoginAt: item.lastLoginAt,
      memberRoleCode: access.memberRoleCode,
      memberRoleName: access.memberRoleName,
      permissionKeys: access.permissionKeys,
      profile: item.profile,
      preference: {
        intentionCity: this.toStringArray(item.preference?.intentionCity),
        intentionJob: this.toStringArray(item.preference?.intentionJob),
        intentionCompany: this.toStringArray(item.preference?.intentionCompany),
      },
      membership: item.membership
        ? {
            id: item.membership.id,
            memberLevel: normalizeStoredMemberLevel(item.membership.memberLevel) ?? 'standard',
            memberLevelLabel: getMemberLevelLabel(item.membership.memberLevel),
            memberRoleCode: access.memberRoleCode,
            memberRoleName: access.memberRoleName,
            startAt: item.membership.startAt,
            endAt: item.membership.endAt,
            remainingDays: access.isMember ? access.membershipRemainingDays : getMembershipRemainingDays(item.membership.endAt, now),
            isActive: isMembershipActive(item.membership.endAt, now),
          }
        : null,
      wallet: item.wallet
        ? {
            availableBalance: this.toNumber(item.wallet.availableBalance),
            frozenBalance: this.toNumber(item.wallet.frozenBalance),
            totalEarn: this.toNumber(item.wallet.totalEarn),
          }
        : null,
    };
  }

  private toAdminMembershipItem(
    item: Prisma.UserMembershipGetPayload<{ include?: { user: { select: { id: true; phone: true; myInviteCode: true } } } }>,
    userPhone: string,
    inviteCode: string,
    effectivePermissionMap: Record<MemberRoleCode, MemberPermissionKey[]>,
    now: Date = new Date(),
  ) {
    const access = buildMemberAccessSnapshot(item, effectivePermissionMap, now);

    return {
      id: item.id,
      userId: item.userId,
      userPhone,
      inviteCode,
      memberLevel: normalizeStoredMemberLevel(item.memberLevel) ?? 'standard',
      memberLevelLabel: getMemberLevelLabel(item.memberLevel),
      memberRoleCode: access.memberRoleCode,
      memberRoleName: access.memberRoleName,
      startAt: item.startAt,
      endAt: item.endAt,
      remainingDays: access.isMember ? access.membershipRemainingDays : getMembershipRemainingDays(item.endAt, now),
      isActive: isMembershipActive(item.endAt, now),
      sourceType: item.sourceType,
      sourceRemark: item.sourceRemark,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private async toUserProfileInput(body: Record<string, unknown>) {
    const name = this.readOptionalString(body.name);
    const graduationYear = this.readOptionalNumber(body.graduationYear);
    const schoolName = this.readOptionalString(body.schoolName);
    const [degree, major] = await Promise.all([
      this.normalizationService.normalizeOptionalValueForStorage('DEGREE', this.readOptionalString(body.degree)),
      this.normalizationService.normalizeOptionalValueForStorage('MAJOR', this.readOptionalString(body.major)),
    ]);

    if ([name, graduationYear, degree, schoolName, major].every((item) => item === undefined || item === '' || item === null)) {
      return null;
    }

    return {
      name,
      graduationYear,
      degree,
      schoolName,
      major,
    };
  }

  private async toUserPreferenceInput(body: Record<string, unknown>) {
    const [intentionCity, intentionJob, intentionCompany] = await Promise.all([
      this.normalizationService.normalizePreferencesForStorage('LOCATION', this.readStringArray(body.intentionCity)),
      this.normalizationService.normalizePreferencesForStorage('JOB_TITLE', this.readStringArray(body.intentionJob)),
      this.normalizationService.normalizePreferencesForStorage('COMPANY', this.readStringArray(body.intentionCompany)),
    ]);

    if (!intentionCity?.length && !intentionJob?.length && !intentionCompany?.length) {
      return null;
    }

    return {
      intentionCity: intentionCity ?? [],
      intentionJob: intentionJob ?? [],
      intentionCompany: intentionCompany ?? [],
    };
  }

  private toServiceProductInput(body: Record<string, unknown>): Prisma.ServiceProductUncheckedCreateInput {
    return {
      name: this.readRequiredString(body.name, '服务名称不能为空'),
      description: this.readRequiredString(body.description, '副标题不能为空'),
      price: this.readRequiredNumber(body.price, '现价不能为空'),
      originalPrice: this.readRequiredNumber(body.originalPrice, '原价不能为空'),
      score: this.readRequiredNumber(body.score, '评分不能为空'),
      salesCount: this.readOptionalNumber(body.salesCount) ?? 0,
      isHot: this.readOptionalBoolean(body.isHot) ?? false,
      status: this.readOptionalBoolean(body.status) ?? true,
      detailHtml: this.readNullableHtml(body.detailHtml) ?? null,
      orderServiceText: this.readNullableString(body.orderServiceText) ?? null,
      orderServiceImageUrl: this.readNullableString(body.orderServiceImageUrl) ?? null,
    };
  }

  private async resolveParentUid(body: Record<string, unknown>) {
    const parentUid = this.readOptionalString(body.parentUid);
    if (parentUid === '') return null;
    if (parentUid) {
      if (body.id && parentUid === body.id) {
        throw new BadRequestException('不能把自己设置为邀请人');
      }
      await this.ensureUserExists(parentUid, '邀请人不存在');
      return parentUid;
    }

    const parentInviteCode = this.readOptionalString(body.parentInviteCode);
    if (!parentInviteCode) return null;
    const parent = await this.prisma.user.findUnique({ where: { myInviteCode: parentInviteCode } });
    if (!parent) {
      throw new BadRequestException('上级邀请码不存在');
    }
    return parent.id;
  }

  private async resolveMembershipUser(body: Record<string, unknown>) {
    const userId = this.readOptionalString(body.userId);
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('用户不存在');
      }
      return user;
    }

    const phone = this.readOptionalString(body.phone);
    if (!phone) {
      throw new BadRequestException('请填写用户手机号');
    }
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    return user;
  }

  private async openMembership(userId: string, days: number, memberLevel: MemberLevel) {
    const current = await this.prisma.userMembership.findUnique({ where: { userId } });
    const now = new Date();
    const currentActive = current ? isMembershipActive(current.endAt, now) : false;
    const startAt = current && currentActive ? current.startAt : now;
    const endBase = current && currentActive ? current.endAt : now;
    const endAt = new Date(endBase.getTime() + days * DAY_IN_MS);
    const remainingDays = this.calculateRemainingDays(endAt, now);
    const currentMemberLevel = normalizeStoredMemberLevel(current?.memberLevel);
    const nextMemberLevel = currentActive && currentMemberLevel === 'super' && memberLevel === 'standard'
      ? 'super'
      : memberLevel;

    return this.prisma.userMembership.upsert({
      where: { userId },
      update: {
        memberLevel: nextMemberLevel,
        startAt,
        endAt,
        remainingDays,
        sourceType: 'manual',
        sourceRemark: `后台开通 ${getMemberLevelLabel(nextMemberLevel)} ${days} 天`,
      },
      create: {
        userId,
        memberLevel: nextMemberLevel,
        startAt,
        endAt,
        remainingDays,
        sourceType: 'manual',
        sourceRemark: `后台开通 ${getMemberLevelLabel(nextMemberLevel)} ${days} 天`,
      },
    });
  }

  private calculateRemainingDays(endAt: Date, now: Date = new Date()) {
    return getMembershipRemainingDays(endAt, now);
  }

  private async ensureCommissionConfig() {
    const existing = await this.prisma.commissionConfig.findFirst({ orderBy: { id: 'asc' } });
    if (existing) return existing;
    return this.prisma.commissionConfig.create({ data: { oneLevelRate: 15 } });
  }

  private async generateInviteCode(phone: string) {
    const suffix = phone.slice(-4);
    for (let index = 0; index < 10; index += 1) {
      const candidate = `OF${suffix}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const existing = await this.prisma.user.findUnique({ where: { myInviteCode: candidate } });
      if (!existing) {
        return candidate;
      }
    }
    return `OF${Date.now().toString(36).toUpperCase()}`;
  }

  private async ensureJobExists(id: string) {
    const exists = await this.prisma.jobAnnouncement.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException('招聘公告不存在');
    }
  }

  private async ensureUserExists(id: string, message = '用户不存在') {
    const exists = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException(message);
    }
  }

  private async ensureMembershipContentExists(id: string) {
    const exists = await this.prisma.membershipRichTextContent.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException('会员权益内容不存在');
    }
  }

  private async ensureCareerJourneyContent() {
    const existing = await this.prisma.membershipRichTextContent.findFirst({
      where: { slug: CAREER_JOURNEY_CONTENT_SLUG },
      orderBy: [{ version: 'desc' }, { updatedAt: 'desc' }],
    });

    if (existing) {
      return existing;
    }

    return this.prisma.membershipRichTextContent.create({
      data: {
        slug: CAREER_JOURNEY_CONTENT_SLUG,
        title: CAREER_JOURNEY_CONTENT_TITLE,
        htmlContent: CAREER_JOURNEY_CONTENT_HTML,
        status: 'published',
        version: 1,
        publishedAt: new Date(),
      },
    });
  }

  private async ensureServiceProductExists(id: string) {
    const exists = await this.prisma.serviceProduct.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException('服务商品不存在');
    }
  }

  private readRequiredString(value: unknown, message: string) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(message);
    }
    return value.trim();
  }

  private readOptionalString(value: unknown) {
    if (value === null) return '';
    if (value === undefined) return undefined;
    if (typeof value !== 'string') return String(value);
    return value.trim();
  }

  private readNullableString(value: unknown) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const normalized = typeof value === 'string' ? value.trim() : String(value).trim();
    return normalized ? normalized : null;
  }

  private readNullableHtml(value: unknown) {
    const normalized = this.readNullableString(value);
    if (normalized === undefined || normalized === null) {
      return normalized;
    }

    const sanitized = normalized
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\s+on\w+=('([^']*)'|"([^"]*)"|[^\s>]+)/gi, '')
      .trim();

    return sanitized || null;
  }

  private readRecord(value: unknown) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private readRequiredHtml(value: unknown, message: string) {
    const normalized = this.readNullableHtml(value);
    if (!normalized) {
      throw new BadRequestException(message);
    }
    return normalized;
  }

  private normalizeStoredHtml(value: unknown, message: string) {
    return this.readRequiredHtml(value, message);
  }

  private async hydrateRichTextContent<T extends { htmlContent: string }>(item: T) {
    const htmlPayload = await this.storageService.buildHtmlPreviewPayload(item.htmlContent);
    return {
      ...item,
      htmlContent: htmlPayload.html,
      previewHtml: htmlPayload.previewHtml,
      assetUrls: htmlPayload.assetUrls,
    };
  }

  private async hydrateServiceProduct<
    T extends {
      price: Prisma.Decimal | number;
      originalPrice: Prisma.Decimal | number;
      score: Prisma.Decimal | number;
      detailHtml?: string | null;
      orderServiceImageUrl?: string | null;
    },
  >(item: T) {
    const detailPayload = await this.storageService.buildHtmlPreviewPayload(item.detailHtml ?? '');
    const orderServiceImagePreviewUrl = await this.storageService.resolveAssetAccessUrl(item.orderServiceImageUrl);

    return {
      ...item,
      price: this.toNumber(item.price),
      originalPrice: this.toNumber(item.originalPrice),
      score: this.toNumber(item.score),
      detailHtml: item.detailHtml ?? null,
      detailPreviewHtml: detailPayload.previewHtml,
      detailAssetUrls: detailPayload.assetUrls,
      orderServiceImageUrl: item.orderServiceImageUrl ?? null,
      orderServiceImagePreviewUrl: orderServiceImagePreviewUrl || null,
    };
  }

  private readFirstDefined<T>(...values: T[]) {
    return values.find((value) => value !== undefined);
  }

  private readRequiredNumber(value: unknown, message: string) {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      throw new BadRequestException(message);
    }
    return parsed;
  }

  private readOptionalNumber(value: unknown) {
    if (value === null || value === undefined || value === '') return undefined;
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      throw new BadRequestException('数值格式不正确');
    }
    return parsed;
  }

  private ensureMinNumber(value: number, min: number, message: string) {
    if (value < min) {
      throw new BadRequestException(message);
    }
    return value;
  }

  private readOptionalBoolean(value: unknown) {
    if (value === null || value === undefined || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      if (value === 'true') return true;
      if (value === 'false') return false;
    }
    return Boolean(value);
  }

  private readOptionalDate(value: unknown) {
    if (!value) return undefined;
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('日期格式不正确');
    }
    return date;
  }

  private readNullableJobTextDate(value: unknown, fieldLabel: string) {
    if (value === undefined) return undefined;
    try {
      return normalizeJobTextDate(value, { fieldLabel, emptyValue: null });
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : `${fieldLabel}格式不正确`);
    }
  }

  private resolveJobEntryDatePayload(value: unknown) {
    const now = new Date();
    const normalizedEntryDate = this.readNullableJobTextDate(value, '录入日期');
    const entryDate = normalizedEntryDate ?? normalizeJobTextDate(now, { fieldLabel: '录入日期', emptyValue: null }) ?? null;
    const createdAt = normalizedEntryDate ? parseJobTextDate(normalizedEntryDate) ?? now : now;

    return {
      entryDate,
      createdAt,
    };
  }

  private readStringArray(value: unknown) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }
    if (typeof value === 'string') {
      return value
        .split(/[,，\n]/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
  }

  private readMemberPermissionKeys(value: unknown): MemberPermissionKey[] {
    const allowedKeys = new Set(MEMBER_PERMISSION_CATALOG.map((item) => item.key));
    return this.readStringArray(value).filter((item): item is MemberPermissionKey => allowedKeys.has(item as MemberPermissionKey));
  }

  private toStringArray(value: unknown) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item));
    }
    return [];
  }

  private toNumber(value: Prisma.Decimal | number | null | undefined) {
    if (value === null || value === undefined) return 0;
    return Number(value);
  }

  private toCurrencyNumber(value: Prisma.Decimal | number | null | undefined) {
    return this.toNumber(value).toFixed(2);
  }
}
