import bcrypt from 'bcryptjs';
import { Prisma, PrismaClient } from '@prisma/client';
// import { MEMBERSHIP_BENEFITS_CONTENT_HTML, MEMBERSHIP_BENEFITS_CONTENT_SLUG, MEMBERSHIP_BENEFITS_CONTENT_TITLE } from '../src/modules/memberships/membership-benefits-content';
const MEMBERSHIP_BENEFITS_CONTENT_SLUG = 'offer360-membership-benefits';
const MEMBERSHIP_BENEFITS_CONTENT_TITLE = 'offer360求职会员权益说明';
const MEMBERSHIP_BENEFITS_CONTENT_HTML = `
<section class="membership-rich-section">
  <h3>权益一：24小时实时更新校招信息，全、准、快、新</h3>
  <div class="membership-rich-lead">
    <h4>求职信息，贵在及时与全面！</h4>
    <p>
      成为会员后，平台平均每日更新超50家企业的校招信息，更新周期长达6个月，截至目前已累计更新2025年全行业12000+条校招资讯。你可通过offer360电脑端官网、手机端筛选并投递岗位，第一时间掌握最新校招动态。
    </p>
    <p>
      加入专属校招会员群，每个工作日都能获取最新校招资讯，确保会员不会错失简历投递的黄金窗口期、补录捡漏期以及冲刺收尾期。
    </p>
  </div>
  <div class="membership-rich-grid">
    <article class="membership-rich-item">
      <h5>信息全面且新鲜</h5>
      <p>
        平台每日整理并更新20至80条校招信息（校招高峰期数量会有所增加），23届至26届毕业生均可找到适配的投递岗位，覆盖秋招、秋招提前批、秋招补录、春招、春招提前批、春招补录、实习等各类招聘批次。
      </p>
    </article>
    <article class="membership-rich-item">
      <h5>覆盖行业广泛</h5>
      <p>
        招聘信息按行业精细分类，涵盖国企央企、外资企业、事业单位、民营企业等各类企业性质，以及互联网、快消、金融、制造业、文娱传媒、新能源、医药、法律、会计师事务所等全行业校招信息。
      </p>
    </article>
    <article class="membership-rich-item">
      <h5>信息来源官方可靠</h5>
      <p>
        所有校招信息均100%来源于企业官方招聘网站、高校就业指导中心平台、合作企业官方发布渠道，确保信息的真实性与有效性。
      </p>
    </article>
  </div>
</section>
`.trim();
// import { DEFAULT_JOBS_RECOMMENDATION_CONFIG } from '../src/modules/jobs/jobs-recommendation-config';
const DEFAULT_JOBS_RECOMMENDATION_CONFIG = {
  companyWeight: 35,
  jobWeight: 30,
  cityExactWeight: 20,
  cityParentWeight: 10,
  degreeWeight: 8,
  majorWeight: 8,
  fresh3DaysWeight: 6,
  fresh7DaysWeight: 3,
  stateOwnedFallbackWeight: 4,
  deliveredPenalty: -12,
  heatMax: 6,
  hotAccessThreshold: 50,
  hotDeliveryThreshold: 10,
};
import {
  locationHierarchySeedItems,
  normalizationAliasSeedItems,
  normalizationTermSeedItems,
} from './jobs-normalization.seed-data';
// import { ensureMemberRoleSetup } from '../src/common/utils/member-access';
async function ensureMemberRoleSetup(prisma: any) {
  const MEMBER_PERMISSION_CATALOG = [
    { key: 'jobs:list:view', name: '招聘公告列表访问权限', group: 'jobs' },
    { key: 'jobs:search:use', name: '岗位搜索权限', group: 'jobs' },
    { key: 'jobs:filter:use', name: '岗位筛选权限', group: 'jobs' },
    { key: 'jobs:detail:view', name: '查看招聘公告详情权限', group: 'jobs' },
    { key: 'jobs:deliver:use', name: '立即投递权限', group: 'jobs' },
    { key: 'jobs:referral:view', name: '查看内推码权限', group: 'jobs' },
    { key: 'jobs:progress:update', name: '标记求职进度权限', group: 'jobs' },
    { key: 'jobs:recommend:view', name: '访问专属推荐模块权限', group: 'jobs' },
  ];

  const MEMBER_ROLE_DEFINITIONS = [
    {
      code: 'FREE_USER',
      name: '免费用户',
      description: '注册默认角色，仅可浏览基础公开内容',
      sortOrder: 10,
      permissionKeys: [],
    },
    {
      code: 'STANDARD_MEMBER',
      name: '标准会员',
      description: '开放招聘列表、搜索筛选、详情查看与立即投递能力',
      sortOrder: 20,
      permissionKeys: ['jobs:list:view', 'jobs:search:use', 'jobs:filter:use', 'jobs:detail:view', 'jobs:deliver:use'],
    },
    {
      code: 'SUPER_MEMBER',
      name: '超级会员',
      description: '在标准会员基础上，额外开放内推码查看与专属推荐能力',
      sortOrder: 30,
      permissionKeys: [
        'jobs:list:view',
        'jobs:search:use',
        'jobs:filter:use',
        'jobs:detail:view',
        'jobs:deliver:use',
        'jobs:referral:view',
        'jobs:progress:update',
        'jobs:recommend:view',
      ],
    },
  ];

  const existingRoles = await prisma.memberRole.findMany({
    select: { id: true, code: true },
  });

  const existingRoleMap = new Map(existingRoles.map((item: any) => [item.code, item]));

  for (const role of MEMBER_ROLE_DEFINITIONS) {
    if (existingRoleMap.has(role.code)) {
      continue;
    }

    await prisma.memberRole.create({
      data: {
        code: role.code,
        name: role.name,
        description: role.description,
        status: 'active',
        isSystem: true,
        sortOrder: role.sortOrder,
        permissions: role.permissionKeys.length
          ? {
              create: role.permissionKeys.map((permissionKey) => {
                const meta = MEMBER_PERMISSION_CATALOG.find((item) => item.key === permissionKey)!;
                return {
                  permissionKey,
                  permissionName: meta.name,
                  permissionGroup: meta.group,
                  permissionType: 'member',
                };
              }),
            }
          : undefined,
      },
    });
  }
}
import { serviceProductSeedItems } from './reference-data';

const prisma = new PrismaClient();

function toPrismaJson(value: Record<string, unknown> | null | undefined) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return Prisma.JsonNull;
  }
  return value as Prisma.InputJsonValue;
}

function normalizeLookupKeyword(value?: string | null) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[·•（）()【】\[\]，,、；;｜|/]/g, '');
}

function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function upsertNormalizationTerms() {
  const activeSeedNames = new Set(normalizationTermSeedItems.map((item) => `${item.domain}__${item.canonicalName}`));

  for (const item of normalizationTermSeedItems) {
    await prisma.normalizationTerm.upsert({
      where: {
        domain_canonicalName: {
          domain: item.domain,
          canonicalName: item.canonicalName,
        },
      },
      update: {
        canonicalCode: item.canonicalCode ?? null,
        level: item.level ?? null,
        status: 'active',
        sortOrder: item.sortOrder,
        metadata: toPrismaJson(item.metadata),
      },
      create: {
        domain: item.domain,
        canonicalName: item.canonicalName,
        canonicalCode: item.canonicalCode ?? null,
        level: item.level ?? null,
        status: 'active',
        sortOrder: item.sortOrder,
        metadata: toPrismaJson(item.metadata),
      },
    });
  }

  const existingTerms = await prisma.normalizationTerm.findMany({
    where: {
      metadata: {
        path: '$.source',
        equals: 'seed',
      },
      status: 'active',
    },
    select: {
      id: true,
      domain: true,
      canonicalName: true,
    },
  });

  const staleTermIds = existingTerms
    .filter((item) => !activeSeedNames.has(`${item.domain}__${item.canonicalName}`))
    .map((item) => item.id);

  if (staleTermIds.length > 0) {
    await prisma.normalizationTerm.updateMany({
      where: { id: { in: staleTermIds } },
      data: { status: 'inactive' },
    });
  }
}

async function upsertNormalizationAliases() {
  const termLookup = await prisma.normalizationTerm.findMany({
    select: {
      id: true,
      domain: true,
      canonicalName: true,
    },
  });
  const termIdMap = new Map(termLookup.map((item) => [`${item.domain}__${item.canonicalName}`, item.id]));

  const activeSeedAliases = new Set<string>();

  for (const item of normalizationAliasSeedItems) {
    const termId = termIdMap.get(`${item.domain}__${item.canonicalName}`);
    if (!termId) {
      throw new Error(`Missing normalization term for alias: ${item.domain} / ${item.canonicalName}`);
    }

    const aliasNormalized = normalizeLookupKeyword(item.aliasName);
    activeSeedAliases.add(`${termId}__${aliasNormalized}`);

    await prisma.normalizationAlias.upsert({
      where: {
        termId_aliasNormalized: {
          termId,
          aliasNormalized,
        },
      },
      update: {
        aliasName: item.aliasName,
        matchMode: item.matchMode,
        status: item.status,
        source: item.source ?? null,
        sortOrder: item.sortOrder,
      },
      create: {
        termId,
        aliasName: item.aliasName,
        aliasNormalized,
        matchMode: item.matchMode,
        status: item.status,
        source: item.source ?? null,
        sortOrder: item.sortOrder,
      },
    });
  }

  const existingAliases = await prisma.normalizationAlias.findMany({
    where: {
      source: 'seed',
      status: 'active',
    },
    select: {
      id: true,
      termId: true,
      aliasNormalized: true,
    },
  });

  const staleAliasIds = existingAliases
    .filter((item) => !activeSeedAliases.has(`${item.termId}__${item.aliasNormalized}`))
    .map((item) => item.id);

  if (staleAliasIds.length > 0) {
    await prisma.normalizationAlias.updateMany({
      where: { id: { in: staleAliasIds } },
      data: { status: 'inactive' },
    });
  }
}

async function upsertLocationHierarchies() {
  const terms = await prisma.normalizationTerm.findMany({
    select: {
      id: true,
      canonicalName: true,
      domain: true,
    },
  });

  const termIdMap = new Map(terms.map((item) => [`${item.domain}__${item.canonicalName}`, item.id]));
  const activeHierarchyKeys = new Set<string>();

  for (const item of locationHierarchySeedItems) {
    const provinceTermId = termIdMap.get(`LOCATION__${item.provinceCanonicalName}`);
    const cityTermId = termIdMap.get(`LOCATION__${item.cityCanonicalName}`);
    if (!provinceTermId || !cityTermId) {
      throw new Error(`Missing location term for hierarchy: ${item.provinceCanonicalName} -> ${item.cityCanonicalName}`);
    }

    activeHierarchyKeys.add(cityTermId);

    await prisma.locationHierarchy.upsert({
      where: { cityTermId },
      update: {
        provinceTermId,
        status: item.status,
      },
      create: {
        provinceTermId,
        cityTermId,
        status: item.status,
      },
    });
  }

  const existingHierarchies = await prisma.locationHierarchy.findMany({
    where: { status: 'active' },
    select: { id: true, cityTermId: true },
  });

  const staleHierarchyIds = existingHierarchies
    .filter((item) => !activeHierarchyKeys.has(item.cityTermId))
    .map((item) => item.id);

  if (staleHierarchyIds.length > 0) {
    await prisma.locationHierarchy.updateMany({
      where: { id: { in: staleHierarchyIds } },
      data: { status: 'inactive' },
    });
  }
}

async function main() {
  await ensureMemberRoleSetup(prisma);
  await upsertNormalizationTerms();
  await upsertNormalizationAliases();
  await upsertLocationHierarchies();

  const passwordHash = await bcrypt.hash('Offer360@123', 10);
  const adminPasswordHash = await bcrypt.hash('Admin@Offer360#2026', 10);
  const now = new Date();
  const membershipEndAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 3650);

  const adminRole = await prisma.adminRole.upsert({
    where: { code: 'super-admin' },
    update: {
      name: '超级管理员',
      description: '拥有后台全部权限',
      status: 'active',
    },
    create: {
      code: 'super-admin',
      name: '超级管理员',
      description: '拥有后台全部权限',
      status: 'active',
    },
  });

  const defaultPermissions = [
    { key: 'dashboard:view', name: '查看数据概览', group: 'dashboard' },
    { key: 'admin:user:manage', name: '用户管理', group: 'users' },
    { key: 'admin:membership:manage', name: '会员体系管理', group: 'memberships' },
    { key: 'admin:service:manage', name: '服务商品与订单管理', group: 'services' },
    { key: 'admin:redeem:manage', name: '兑换码管理', group: 'redeem' },
    { key: 'admin:job:manage', name: '招聘公告与词典管理', group: 'jobs' },
  ];

  for (const permission of defaultPermissions) {
    await prisma.adminRolePermission.upsert({
      where: {
        roleId_permissionKey: {
          roleId: adminRole.id,
          permissionKey: permission.key,
        },
      },
      update: {
        permissionName: permission.name,
        permissionGroup: permission.group,
        permissionType: 'api',
      },
      create: {
        roleId: adminRole.id,
        permissionKey: permission.key,
        permissionName: permission.name,
        permissionGroup: permission.group,
        permissionType: 'api',
      },
    });
  }

  const adminUser = await prisma.adminUser.upsert({
    where: { username: 'offer360_admin' },
    update: {
      passwordHash: adminPasswordHash,
      realName: 'Offer360 超管',
      phone: '19900000000',
      email: 'admin@offer360.local',
      status: 'active',
      remark: '默认超级管理员账号',
    },
    create: {
      username: 'offer360_admin',
      passwordHash: adminPasswordHash,
      realName: 'Offer360 超管',
      phone: '19900000000',
      email: 'admin@offer360.local',
      status: 'active',
      remark: '默认超级管理员账号',
    },
  });

  await prisma.adminUserRole.upsert({
    where: {
      adminUserId_roleId: {
        adminUserId: adminUser.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      adminUserId: adminUser.id,
      roleId: adminRole.id,
    },
  });

  const user = await prisma.user.upsert({
    where: { phone: '18888888888' },
    update: {
      passwordHash,
      myInviteCode: 'OFFER360',
      status: 'active',
      sourceType: 'seed',
      lastLoginAt: now,
      profile: {
        upsert: {
          update: {
            name: 'Offer360 测试用户',
            graduationYear: 2026,
            degree: '本科',
            schoolName: '南京大学',
            major: '计算机',
          },
          create: {
            name: 'Offer360 测试用户',
            graduationYear: 2026,
            degree: '本科',
            schoolName: '南京大学',
            major: '计算机',
          },
        },
      },
      preference: {
        upsert: {
          update: {
            intentionCity: ['北京'],
            intentionJob: ['产品', '运营', '测试'],
            intentionCompany: ['腾讯'],
          },
          create: {
            intentionCity: ['北京'],
            intentionJob: ['产品', '运营', '测试'],
            intentionCompany: ['腾讯'],
          },
        },
      },
      membership: {
        upsert: {
          update: {
            memberLevel: 'super',
            startAt: now,
            endAt: membershipEndAt,
            remainingDays: 3650,
            sourceType: 'seed',
            sourceRemark: '初始化超级会员',
          },
          create: {
            memberLevel: 'super',
            startAt: now,
            endAt: membershipEndAt,
            remainingDays: 3650,
            sourceType: 'seed',
            sourceRemark: '初始化超级会员',
          },
        },
      },
    },
    create: {
      phone: '18888888888',
      passwordHash,
      myInviteCode: 'OFFER360',
      status: 'active',
      sourceType: 'seed',
      lastLoginAt: now,
      profile: {
        create: {
          name: 'Offer360 测试用户',
          graduationYear: 2026,
          degree: '本科',
          schoolName: '南京大学',
          major: '计算机',
        },
      },
      preference: {
        create: {
          intentionCity: ['北京'],
          intentionJob: ['产品', '运营', '测试'],
          intentionCompany: ['腾讯'],
        },
      },
      membership: {
        create: {
          memberLevel: 'super',
          startAt: now,
          endAt: membershipEndAt,
          remainingDays: 3650,
          sourceType: 'seed',
          sourceRemark: '初始化超级会员',
        },
      },
    },
    include: {
      membership: true,
    },
  });

  await prisma.jobsRecommendationConfig.upsert({
    where: { id: 1 },
    update: DEFAULT_JOBS_RECOMMENDATION_CONFIG,
    create: {
      id: 1,
      ...DEFAULT_JOBS_RECOMMENDATION_CONFIG,
    },
  });

  await prisma.membershipRichTextContent.upsert({
    where: { slug: MEMBERSHIP_BENEFITS_CONTENT_SLUG },
    update: {
      title: MEMBERSHIP_BENEFITS_CONTENT_TITLE,
      htmlContent: MEMBERSHIP_BENEFITS_CONTENT_HTML,
      status: 'published',
      publishedAt: now,
      publishedByAdminId: adminUser.id,
    },
    create: {
      slug: MEMBERSHIP_BENEFITS_CONTENT_SLUG,
      title: MEMBERSHIP_BENEFITS_CONTENT_TITLE,
      htmlContent: MEMBERSHIP_BENEFITS_CONTENT_HTML,
      status: 'published',
      version: 1,
      publishedAt: now,
      publishedByAdminId: adminUser.id,
    },
  });

  for (const item of serviceProductSeedItems) {
    await prisma.serviceProduct.upsert({
      where: { id: item.id },
      update: {
        name: item.name,
        description: item.description,
        price: item.price,
        originalPrice: item.originalPrice,
        score: item.score,
        salesCount: item.salesCount,
        isHot: item.isHot,
        status: true,
        productType: item.productType,
        memberLevel: item.memberLevel ?? null,
        grantDays: item.grantDays ?? null,
        detailHtml: item.detailHtml ?? null,
        orderServiceText: item.orderServiceText ?? null,
        orderServiceImageUrl: item.orderServiceImageUrl ?? null,
      },
      create: {
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        originalPrice: item.originalPrice,
        score: item.score,
        salesCount: item.salesCount,
        isHot: item.isHot,
        status: true,
        productType: item.productType,
        memberLevel: item.memberLevel ?? null,
        grantDays: item.grantDays ?? null,
        detailHtml: item.detailHtml ?? null,
        orderServiceText: item.orderServiceText ?? null,
        orderServiceImageUrl: item.orderServiceImageUrl ?? null,
      },
    });
  }

  const jobs = [
    {
      id: 'job-001',
      companyFullName: '江苏中烟工业有限责任公司',
      enterpriseNature: '央企',
      degreeRequirement: '本科',
      workLocation: '南京,无锡',
      jobName: '软件开发工程师,数据分析工程师',
      majorRequirement: '计算机类、软件工程、数据分析相关专业',
      recruitmentType: '校招',
      deadlineAt: formatDateOnly(new Date(Date.now() + 1000 * 60 * 60 * 24 * 12)),
      announcementUrl: 'https://www.jssrcw.com/article.php?id=611',
      deliveryUrl: 'https://jszy.ksbm.com/',
      graduationSession: '2026届',
      referralCode: 'JSZY2026',
      announcementTitle: '江苏中烟 2026 届校园招聘公告',
      industry: '烟草制造',
      entryDate: formatDateOnly(now),
      status: 'published',
    },
    {
      id: 'job-002',
      companyFullName: '中国电信江苏公司',
      enterpriseNature: '国企',
      degreeRequirement: '本科',
      workLocation: '南京,苏州',
      jobName: '前端开发工程师,后端开发工程师',
      majorRequirement: '计算机类、通信类、电子信息类相关专业',
      recruitmentType: '校招',
      deadlineAt: formatDateOnly(new Date(Date.now() + 1000 * 60 * 60 * 24 * 9)),
      announcementUrl: 'http://www.chinatelecom.com.cn/zp/',
      deliveryUrl: 'https://job.chinatelecom.com.cn/wt/TELE/web/index#/',
      graduationSession: '2026届',
      referralCode: 'CTJS2026',
      announcementTitle: '中国电信江苏公司 2026 校园招聘',
      industry: '通信运营',
      entryDate: formatDateOnly(now),
      status: 'published',
    },
    {
      id: 'job-003',
      companyFullName: '腾讯科技（深圳）有限公司',
      enterpriseNature: '民营企业',
      degreeRequirement: '本科',
      workLocation: '北京,深圳',
      jobName: '产品经理,运营专员,测试工程师',
      majorRequirement: '计算机类、统计学、市场营销、管理学相关专业',
      recruitmentType: '校招',
      deadlineAt: formatDateOnly(new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)),
      announcementUrl: 'https://hr.tencent.com/m/zh-cn/campusrecruit.html',
      deliveryUrl: 'https://join.qq.com/post.html',
      graduationSession: '2026届',
      referralCode: 'TX2026',
      announcementTitle: '腾讯 2026 届校园招聘',
      industry: '互联网',
      entryDate: formatDateOnly(now),
      status: 'published',
    },
  ];

  for (const job of jobs) {
    await prisma.jobAnnouncement.upsert({
      where: { id: job.id },
      update: { ...job },
      create: {
        ...job,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  const orderedProducts = await prisma.serviceProduct.findMany({
    where: { productType: 'service' },
    take: 3,
    orderBy: { salesCount: 'desc' },
  });
  for (const product of orderedProducts) {
    await prisma.serviceOrder.upsert({
      where: { orderNo: `SO-${product.id}` },
      update: {
        orderType: 'service',
        title: product.name,
        amount: product.price,
        payStatus: 'paid',
        payChannel: 'manual',
        payTime: now,
        remark: '初始化演示订单',
      },
      create: {
        orderNo: `SO-${product.id}`,
        userId: user.id,
        productId: product.id,
        orderType: 'service',
        title: product.name,
        amount: product.price,
        payStatus: 'paid',
        payChannel: 'manual',
        payTime: now,
        remark: '初始化演示订单',
      },
    });
  }

  await prisma.invRedirectLink.upsert({
    where: { randomKey: 'invite-offer360-demo' },
    update: { inviterUid: user.id },
    create: {
      randomKey: 'invite-offer360-demo',
      inviterUid: user.id,
      expireAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
    },
  });

  const invitees = [
    { phone: '18800000001', code: 'FRIEND001' },
    { phone: '18800000002', code: 'FRIEND002' },
    { phone: '18800000003', code: 'FRIEND003' },
  ];

  for (const invitee of invitees) {
    await prisma.user.upsert({
      where: { phone: invitee.phone },
      update: { parentUid: user.id, status: 'active', sourceType: 'seed_invite' },
      create: {
        phone: invitee.phone,
        passwordHash,
        myInviteCode: invitee.code,
        parentUid: user.id,
        status: 'active',
        sourceType: 'seed_invite',
      },
    });
  }

  const redeemBatch = await prisma.membershipRedeemCodeBatch.upsert({
    where: { batchNo: 'RC20260425A' },
    update: {
      memberLevel: 'super',
      cardType: 'month',
      grantDays: 30,
      quantity: 4,
      status: 'active',
      validFrom: now,
      validUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180),
      remark: '方案C初始化演示兑换码批次',
      createdByAdminId: adminUser.id,
    },
    create: {
      batchNo: 'RC20260425A',
      memberLevel: 'super',
      cardType: 'month',
      grantDays: 30,
      quantity: 4,
      status: 'active',
      validFrom: now,
      validUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180),
      remark: '方案C初始化演示兑换码批次',
      createdByAdminId: adminUser.id,
    },
  });

  const demoRedeemCodes = [
    'OF360-MONTH-0001',
    'OF360-MONTH-0002',
    'OF360-MONTH-0003',
    'OF360-MONTH-0004',
  ];

  for (const code of demoRedeemCodes) {
    await prisma.membershipRedeemCode.upsert({
      where: { code },
      update: {
        batchId: redeemBatch.id,
        status: 'unused',
        validUntil: redeemBatch.validUntil,
        usedByUserId: null,
        usedAt: null,
        invalidatedByAdminId: null,
        invalidatedAt: null,
        invalidReason: null,
      },
      create: {
        code,
        batchId: redeemBatch.id,
        status: 'unused',
        validUntil: redeemBatch.validUntil,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
