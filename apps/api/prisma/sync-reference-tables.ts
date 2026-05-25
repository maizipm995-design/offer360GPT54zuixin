import { Prisma, PrismaClient } from '@prisma/client';

import {
  locationHierarchySeedItems,
  normalizationAliasSeedItems,
  normalizationTermSeedItems,
} from './jobs-normalization.seed-data';
import { serviceProductSeedItems } from './reference-data';

if (process.env.CONFIRM_SYNC_REFERENCE_TABLES !== 'YES') {
  throw new Error('Refuse to run: set CONFIRM_SYNC_REFERENCE_TABLES=YES to proceed.');
}

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

async function upsertServiceProducts() {
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
}

async function main() {
  await upsertNormalizationTerms();
  await upsertNormalizationAliases();
  await upsertLocationHierarchies();
  await upsertServiceProducts();

  const [termCount, aliasCount, hierarchyCount, productCount] = await Promise.all([
    prisma.normalizationTerm.count({ where: { status: 'active' } }),
    prisma.normalizationAlias.count({ where: { status: 'active' } }),
    prisma.locationHierarchy.count({ where: { status: 'active' } }),
    prisma.serviceProduct.count({ where: { status: true } }),
  ]);

  console.log(
    JSON.stringify(
      {
        normalizationTermsActive: termCount,
        normalizationAliasesActive: aliasCount,
        locationHierarchiesActive: hierarchyCount,
        serviceProductsActive: productCount,
      },
      null,
      2,
    ),
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
