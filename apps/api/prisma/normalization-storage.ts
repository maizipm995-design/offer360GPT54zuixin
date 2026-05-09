import { PrismaClient } from '@prisma/client';

export const STORAGE_NORMALIZATION_DOMAINS = ['LOCATION', 'JOB_TITLE', 'MAJOR', 'DEGREE', 'COMPANY'] as const;

export type StorageNormalizationDomain = (typeof STORAGE_NORMALIZATION_DOMAINS)[number];
export type StorageNormalizationLookup = Record<StorageNormalizationDomain, Map<string, string>>;

function createEmptyLookup(): StorageNormalizationLookup {
  return STORAGE_NORMALIZATION_DOMAINS.reduce((accumulator, domain) => {
    accumulator[domain] = new Map<string, string>();
    return accumulator;
  }, {} as StorageNormalizationLookup);
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((item) => String(item ?? '').trim()).filter(Boolean)));
}

export function normalizeDictionaryLookup(value?: string | null) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[·•（）()【】\[\]，,、；;｜|/]/g, '');
}

export async function loadNormalizationLookup(
  prisma: PrismaClient,
  domains: StorageNormalizationDomain[] = [...STORAGE_NORMALIZATION_DOMAINS],
): Promise<StorageNormalizationLookup> {
  const lookup = createEmptyLookup();
  const terms = await prisma.normalizationTerm.findMany({
    where: {
      status: 'active',
      domain: { in: [...domains] },
    },
    include: {
      aliases: {
        where: { status: 'active' },
      },
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  terms.forEach((term) => {
    const domain = term.domain as StorageNormalizationDomain;
    if (!domains.includes(domain)) {
      return;
    }

    const keywords = uniqueStrings([term.canonicalName, ...term.aliases.map((item) => item.aliasName)]);
    keywords
      .map((item) => normalizeDictionaryLookup(item))
      .filter(Boolean)
      .forEach((key) => {
        if (!lookup[domain].has(key)) {
          lookup[domain].set(key, term.canonicalName);
        }
      });
  });

  return lookup;
}

function resolveCanonical(
  lookup: StorageNormalizationLookup,
  domain: StorageNormalizationDomain,
  input: string,
) {
  const trimmed = input.trim();
  if (!trimmed) {
    return '';
  }

  return lookup[domain].get(normalizeDictionaryLookup(trimmed)) ?? trimmed;
}

export function normalizeOptionalValueForStorage(
  lookup: StorageNormalizationLookup,
  domain: Exclude<StorageNormalizationDomain, 'LOCATION' | 'JOB_TITLE' | 'COMPANY'> | StorageNormalizationDomain,
  input?: string | null,
) {
  if (input === undefined) {
    return undefined;
  }
  if (input === null) {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  return resolveCanonical(lookup, domain, trimmed);
}

export function normalizePreferencesForStorage(
  lookup: StorageNormalizationLookup,
  domain: StorageNormalizationDomain,
  input?: string[] | null,
) {
  if (input === undefined) {
    return undefined;
  }
  if (!input?.length) {
    return [];
  }

  return uniqueStrings(input.map((item) => resolveCanonical(lookup, domain, item)));
}
