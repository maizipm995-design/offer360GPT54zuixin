import { Injectable } from '@nestjs/common';
import { clearJobsNormalizationCache, getJobsNormalizationCache, setJobsNormalizationCache } from './jobs-normalization.cache';
import { JobsNormalizationRepository } from './jobs-normalization.repository';
import {
  JOBS_NORMALIZATION_DOMAINS,
  JobsNormalizationDomain,
  JobsNormalizationSnapshot,
  LocationDictionarySnapshot,
  LocationPreferenceKeyword,
  NormalizationDomainSnapshot,
  NormalizationTermSnapshot,
  NormalizedPreferenceKeyword,
} from './jobs-normalization.types';

function normalizeLookupKeyword(value?: string | null) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[·•（）()【】\[\]，,、；;｜|/]/g, '');
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function readMetadataString(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}

function createEmptyDomainSnapshot(): NormalizationDomainSnapshot {
  return {
    terms: [],
    lookupMap: new Map<string, NormalizationTermSnapshot>(),
    canonicalMap: new Map<string, NormalizationTermSnapshot>(),
  };
}

@Injectable()
export class JobsNormalizationService {
  private snapshotPromise: Promise<JobsNormalizationSnapshot> | null = null;

  constructor(private readonly repository: JobsNormalizationRepository) {}

  async normalizePreferences(domain: JobsNormalizationDomain, input: string[]): Promise<NormalizedPreferenceKeyword[]> {
    const snapshot = await this.getSnapshot();
    const domainSnapshot = snapshot.domains[domain];
    const deduped = new Map<string, NormalizedPreferenceKeyword>();

    uniqueStrings(input).forEach((raw) => {
      const lookupKey = normalizeLookupKeyword(raw);
      const matchedTerm = domainSnapshot.lookupMap.get(lookupKey);
      const result: NormalizedPreferenceKeyword = !matchedTerm
        ? {
            raw,
            canonical: raw,
            aliases: [raw],
            aliasNormalized: [lookupKey].filter(Boolean),
            searchKeywords: [raw],
            searchNormalized: [lookupKey].filter(Boolean),
            matched: false,
          }
        : {
            raw,
            canonicalId: matchedTerm.id,
            canonical: matchedTerm.canonical,
            aliases: [...matchedTerm.aliases],
            aliasNormalized: [...matchedTerm.aliasNormalized],
            searchKeywords: [...matchedTerm.searchKeywords],
            searchNormalized: [...matchedTerm.searchNormalized],
            matched: true,
          };

      const dedupeKey = result.matched ? `matched:${result.canonicalId}` : `raw:${lookupKey}`;
      if (!deduped.has(dedupeKey)) {
        deduped.set(dedupeKey, result);
      }
    });

    return Array.from(deduped.values());
  }

  async normalizeSingle(domain: JobsNormalizationDomain, input?: string | null) {
    if (!input?.trim()) {
      return null;
    }
    const [result] = await this.normalizePreferences(domain, [input]);
    return result ?? null;
  }

  async extractCanonicalOptionsFromText(domain: JobsNormalizationDomain, input?: string | null) {
    const trimmed = input?.trim();
    if (!trimmed) {
      return [];
    }

    const snapshot = await this.getSnapshot();
    const normalizedText = normalizeLookupKeyword(trimmed);
    const matchedCanonicalNames = snapshot.domains[domain].terms
      .filter((term) => term.searchNormalized.some((keyword) => keyword && normalizedText.includes(keyword)))
      .map((term) => term.canonical);

    if (matchedCanonicalNames.length) {
      return uniqueStrings(matchedCanonicalNames);
    }

    const exactMatched = await this.normalizeSingle(domain, trimmed);
    return exactMatched?.matched ? [exactMatched.canonical] : [];
  }

  async normalizePreferencesForStorage(domain: JobsNormalizationDomain, input?: string[] | null) {
    if (input === undefined) {
      return undefined;
    }
    if (!input?.length) {
      return [];
    }

    const normalized = await this.normalizePreferences(domain, input);
    return uniqueStrings(
      normalized
        .map((item) => (item.matched ? item.canonical : item.raw.trim()))
        .filter(Boolean),
    );
  }

  async normalizeOptionalValueForStorage(domain: JobsNormalizationDomain, input?: string | null) {
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

    const normalized = await this.normalizeSingle(domain, trimmed);
    return normalized?.matched ? normalized.canonical : trimmed;
  }

  async normalizeLocationPreferences(input: string[]): Promise<LocationPreferenceKeyword[]> {
    const [snapshot, normalizedLocations] = await Promise.all([this.getSnapshot(), this.normalizePreferences('LOCATION', input)]);
    const locationSnapshot = snapshot.domains.LOCATION;
    const cityParentProvinceMap = snapshot.locationDictionary.cityParentProvinceMap;
    const siblingCityMap = new Map<string, string[]>();

    Object.entries(cityParentProvinceMap).forEach(([city, province]) => {
      const list = siblingCityMap.get(province) ?? [];
      list.push(city);
      siblingCityMap.set(province, list);
    });

    return normalizedLocations.map<LocationPreferenceKeyword>((item) => {
      const term = locationSnapshot.canonicalMap.get(item.canonical);
      const kind = term?.level === 'province' || term?.level === 'city' ? term.level : 'unknown';
      const parentProvince = kind === 'city' ? cityParentProvinceMap[item.canonical] ?? null : null;
      const parentProvinceAliases = parentProvince
        ? (locationSnapshot.canonicalMap.get(parentProvince)?.aliases ?? [parentProvince])
        : [];
      const siblingCityKeywords = parentProvince
        ? (siblingCityMap.get(parentProvince) ?? []).filter((city) => city !== item.canonical)
        : [];

      return {
        raw: item.raw,
        canonical: item.canonical,
        aliases: item.aliases,
        kind,
        parentProvince,
        parentProvinceAliases,
        siblingCityKeywords,
      };
    });
  }

  async getLocationDictionary(): Promise<LocationDictionarySnapshot> {
    const snapshot = await this.getSnapshot();
    return snapshot.locationDictionary;
  }

  async getDomainTerms(domain: JobsNormalizationDomain) {
    const snapshot = await this.getSnapshot();
    return snapshot.domains[domain].terms;
  }

  normalizeTextForMatch(value?: string | null) {
    return normalizeLookupKeyword(value);
  }

  clearCache() {
    clearJobsNormalizationCache();
  }

  private async getSnapshot(): Promise<JobsNormalizationSnapshot> {
    const cached = getJobsNormalizationCache();
    if (cached) {
      return cached;
    }

    if (!this.snapshotPromise) {
      this.snapshotPromise = this.buildSnapshot().finally(() => {
        this.snapshotPromise = null;
      });
    }

    return this.snapshotPromise;
  }

  private async buildSnapshot(): Promise<JobsNormalizationSnapshot> {
    const [terms, locationHierarchies] = await Promise.all([
      this.repository.getActiveTerms(),
      this.repository.getActiveLocationHierarchies(),
    ]);

    const domains = JOBS_NORMALIZATION_DOMAINS.reduce((accumulator, domain) => {
      accumulator[domain] = createEmptyDomainSnapshot();
      return accumulator;
    }, {} as Record<JobsNormalizationDomain, NormalizationDomainSnapshot>);

    terms.forEach((term) => {
      const domain = term.domain as JobsNormalizationDomain;
      if (!JOBS_NORMALIZATION_DOMAINS.includes(domain)) {
        return;
      }

      const aliases = uniqueStrings([term.canonicalName, ...term.aliases.map((item) => item.aliasName)]);
      const aliasNormalized = uniqueStrings(aliases.map((item) => normalizeLookupKeyword(item)));
      const searchKeywords = uniqueStrings([
        term.canonicalName,
        ...(
          domain === 'LOCATION'
            ? term.aliases.map((item) => item.aliasName)
            : term.aliases
              .filter((item) => item.matchMode === 'contains')
              .map((item) => item.aliasName)
        ),
      ]);
      const searchNormalized = uniqueStrings(searchKeywords.map((item) => normalizeLookupKeyword(item)));
      const snapshotTerm: NormalizationTermSnapshot = {
        id: term.id,
        domain,
        canonical: term.canonicalName,
        aliases,
        aliasNormalized,
        searchKeywords,
        searchNormalized,
        level: term.level,
        sortOrder: term.sortOrder,
        region: readMetadataString(term.metadata, 'region'),
        intendedProvince: readMetadataString(term.metadata, 'intendedProvince'),
      };

      const domainSnapshot = domains[domain];
      domainSnapshot.terms.push(snapshotTerm);
      domainSnapshot.canonicalMap.set(snapshotTerm.canonical, snapshotTerm);
      aliasNormalized.forEach((key) => {
        if (!domainSnapshot.lookupMap.has(key)) {
          domainSnapshot.lookupMap.set(key, snapshotTerm);
        }
      });
    });

    const cityParentProvinceMap = locationHierarchies.reduce<Record<string, string>>((accumulator, item) => {
      accumulator[item.cityTerm.canonicalName] = item.provinceTerm.canonicalName;
      return accumulator;
    }, {});

    const locationDictionary: LocationDictionarySnapshot = {
      aliasEntries: domains.LOCATION.terms.map((term) => ({
        canonical: term.canonical,
        aliases: [...term.aliases],
      })),
      cityParentProvinceMap,
    };

    const snapshot: JobsNormalizationSnapshot = {
      domains,
      locationDictionary,
    };

    setJobsNormalizationCache(snapshot);
    return snapshot;
  }
}
