import bcrypt from 'bcryptjs';
import { Prisma, PrismaClient } from '@prisma/client';
import { MEMBERSHIP_BENEFITS_CONTENT_HTML, MEMBERSHIP_BENEFITS_CONTENT_SLUG, MEMBERSHIP_BENEFITS_CONTENT_TITLE } from '../src/modules/memberships/membership-benefits-content';
import { DEFAULT_JOBS_RECOMMENDATION_CONFIG } from '../src/modules/jobs/jobs-recommendation-config';
import {
  locationHierarchySeedItems,
  normalizationAliasSeedItems,
  normalizationTermSeedItems,
} from '../src/modules/jobs/jobs-normalization.seed-data';
import { ensureMemberRoleSetup } from '../src/common/utils/member-access';

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

  const serviceProducts = [
    ['简历精修', '专业 HR 一对一精修简历，提升面试通过率，突出核心竞争力', 1, 399, 4.8, 2355, true],
    ['面试辅导', '资深面试官模拟面试，针对性指导，提升面试表现和应对能力', 1, 599, 4.9, 1876, true],
    ['笔试代做', '专业团队代做各类笔试题，保证高分通过，快速拿到 offer', 1, 799, 4.7, 1234, true],
    ['求职全流程', '从简历到入职全程陪伴，一站式解决求职难题，保 offer 服务', 70, 1999, 4.9, 856, false],
    ['职业规划', '资深职业规划师一对一咨询，明确职业方向，制定发展路径', 1, 799, 4.8, 1567, true],
    ['背景提升', '实习推荐、项目经历包装，快速提升个人竞争力和简历含金量', 30, 1199, 4.6, 923, false],
    ['offer 谈判', '薪资谈判技巧指导，帮你争取更高薪资和更好的入职条件', 1, 599, 4.8, 1345, true],
    ['内推服务', '名企内推资源，跳过简历筛选，直达面试环节，提高成功率', 1, 999, 4.9, 2134, true],
  ] as const;

  for (const [name, description, price, originalPrice, score, salesCount, isHot] of serviceProducts) {
    await prisma.serviceProduct.upsert({
      where: { id: `service-${name}` },
      update: {
        name,
        description,
        price,
        originalPrice,
        score,
        salesCount,
        isHot,
        status: true,
        productType: 'service',
        memberLevel: null,
        grantDays: null,
      },
      create: {
        id: `service-${name}`,
        name,
        description,
        price,
        originalPrice,
        score,
        salesCount,
        isHot,
        status: true,
        productType: 'service',
      },
    });
  }

  const membershipProducts = [
    {
      id: 'membership-standard-180',
      name: '标准会员 · 180 天',
      description: '开放招聘列表、搜索筛选、详情查看与立即投递能力，适合需要高频找岗投递的同学。',
      price: 88,
      originalPrice: 199,
      score: 4.8,
      salesCount: 680,
      isHot: false,
      memberLevel: 'standard',
      grantDays: 180,
    },
    {
      id: 'membership-super-180',
      name: 'offer360求职会员',
      description: '覆盖校招公告、AI专属岗位推荐、求职资料包与直播辅导的年度求职会员服务。',
      price: 99,
      originalPrice: 199,
      score: 4.9,
      salesCount: 420,
      isHot: true,
      memberLevel: 'super',
      grantDays: 365,
    },
  ] as const;

  for (const item of membershipProducts) {
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
        productType: 'membership',
        memberLevel: item.memberLevel,
        grantDays: item.grantDays,
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
        productType: 'membership',
        memberLevel: item.memberLevel,
        grantDays: item.grantDays,
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
      jobCategory: '技术类',
      recruitmentType: '校招',
      deadlineAt: formatDateOnly(new Date(Date.now() + 1000 * 60 * 60 * 24 * 12)),
      announcementUrl: 'https://offer360.cn/jobs/jiangsu-tobacco-2026',
      deliveryUrl: 'https://offer360.cn/deliver/jiangsu-tobacco-2026',
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
      jobCategory: '技术类',
      recruitmentType: '校招',
      deadlineAt: formatDateOnly(new Date(Date.now() + 1000 * 60 * 60 * 24 * 9)),
      announcementUrl: 'https://offer360.cn/jobs/chinatelecom-2026',
      deliveryUrl: 'https://offer360.cn/deliver/chinatelecom-2026',
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
      jobCategory: '产品/运营/测试',
      recruitmentType: '校招',
      deadlineAt: formatDateOnly(new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)),
      announcementUrl: 'https://offer360.cn/jobs/tencent-2026',
      deliveryUrl: 'https://offer360.cn/deliver/tencent-2026',
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
