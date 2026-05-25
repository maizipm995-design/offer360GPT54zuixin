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

type NormalizationSuggestionMatchType = 'exact' | 'prefix' | 'contains' | 'sentence';

type NormalizationSuggestionItem = {
  domain: JobsNormalizationDomain;
  canonical: string;
  matchedAlias: string | null;
  relatedKeywords: string[];
  score: number;
  sortOrder: number;
};

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

function scoreSuggestionMatch(
  input: string,
  target: string,
): { matched: boolean; score: number; matchType: NormalizationSuggestionMatchType | null } {
  const normalizedInput = normalizeLookupKeyword(input);
  const normalizedTarget = normalizeLookupKeyword(target);
  if (!normalizedInput || !normalizedTarget) {
    return { matched: false, score: 0, matchType: null };
  }
  if (normalizedTarget === normalizedInput) {
    return { matched: true, score: 400, matchType: 'exact' };
  }
  if (normalizedTarget.startsWith(normalizedInput)) {
    return { matched: true, score: 320, matchType: 'prefix' };
  }
  if (normalizedTarget.includes(normalizedInput)) {
    return { matched: true, score: 240, matchType: 'contains' };
  }
  if (normalizedInput.includes(normalizedTarget)) {
    return { matched: true, score: 180, matchType: 'sentence' };
  }
  return { matched: false, score: 0, matchType: null };
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

  async expandSearchKeywords(domain: JobsNormalizationDomain, input?: string | null) {
    const trimmed = input?.trim();
    if (!trimmed) {
      return [];
    }

    const snapshot = await this.getSnapshot();
    const domainSnapshot = snapshot.domains[domain];
    const relatedCanonicals = new Set<string>();
    const exactMatched = await this.normalizeSingle(domain, trimmed);

    if (exactMatched?.matched) {
      relatedCanonicals.add(exactMatched.canonical);
    }

    const extractedCanonicals = await this.extractCanonicalOptionsFromText(domain, trimmed);
    extractedCanonicals.forEach((canonical) => relatedCanonicals.add(canonical));

    const expandedKeywords = new Set<string>([trimmed]);
    relatedCanonicals.forEach((canonical) => {
      const term = domainSnapshot.canonicalMap.get(canonical);
      if (!term) {
        expandedKeywords.add(canonical);
        return;
      }
      term.aliases.forEach((alias) => expandedKeywords.add(alias));
      term.searchKeywords.forEach((keyword) => expandedKeywords.add(keyword));
    });

    return uniqueStrings(Array.from(expandedKeywords));
  }

  async getSuggestions(domain: JobsNormalizationDomain, input?: string | null, limit = 8) {
    const trimmed = input?.trim();
    if (!trimmed) {
      return [];
    }

    const snapshot = await this.getSnapshot();
    const suggestions = snapshot.domains[domain].terms
      .map<NormalizationSuggestionItem | null>((term) => {
        const canonicalMatch = scoreSuggestionMatch(trimmed, term.canonical);
        const aliasMatches = term.aliases
          .map((alias) => ({
            alias,
            result: scoreSuggestionMatch(trimmed, alias),
          }))
          .filter((item) => item.result.matched)
          .sort((left, right) => {
            if (right.result.score !== left.result.score) {
              return right.result.score - left.result.score;
            }
            return left.alias.localeCompare(right.alias, 'zh-Hans-CN');
          });

        if (!canonicalMatch.matched && !aliasMatches.length) {
          return null;
        }

        const bestAlias = aliasMatches[0];
        const score = Math.max(
          canonicalMatch.matched ? canonicalMatch.score + 10 : 0,
          bestAlias ? bestAlias.result.score + (bestAlias.alias === term.canonical ? 5 : 30) : 0,
        );

        return {
          domain,
          canonical: term.canonical,
          matchedAlias: bestAlias && bestAlias.alias !== term.canonical ? bestAlias.alias : null,
          relatedKeywords: uniqueStrings(term.aliases).slice(0, 6),
          score,
          sortOrder: term.sortOrder,
        };
      })
      .filter((item): item is NormalizationSuggestionItem => Boolean(item))
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        if (left.sortOrder !== right.sortOrder) {
          return left.sortOrder - right.sortOrder;
        }
        return left.canonical.localeCompare(right.canonical, 'zh-Hans-CN');
      })
      .slice(0, limit);

    return suggestions.map(({ domain: suggestionDomain, canonical, matchedAlias, relatedKeywords }) => ({
      domain: suggestionDomain,
      canonical,
      matchedAlias,
      relatedKeywords,
    }));
  }

  async getMultiDomainSuggestions(domains: JobsNormalizationDomain[], input?: string | null, limit = 8) {
    const groups = await Promise.all(domains.map((domain) => this.getSuggestions(domain, input, limit)));
    const deduped = new Map<string, Awaited<ReturnType<JobsNormalizationService['getSuggestions']>>[number]>();

    groups.flat().forEach((item) => {
      const key = `${item.domain}:${item.canonical}`;
      if (!deduped.has(key)) {
        deduped.set(key, item);
      }
    });

    return Array.from(deduped.values()).slice(0, limit);
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
          domain === 'LOCATION' || domain === 'COMPANY'
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
