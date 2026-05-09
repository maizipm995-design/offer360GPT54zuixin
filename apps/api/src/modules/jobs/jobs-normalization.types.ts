export const JOBS_NORMALIZATION_DOMAINS = ['LOCATION', 'JOB_TITLE', 'MAJOR', 'DEGREE', 'COMPANY'] as const;

export type JobsNormalizationDomain = (typeof JOBS_NORMALIZATION_DOMAINS)[number];
export type JobsLocationKind = 'province' | 'city' | 'unknown';

export interface NormalizationTermSnapshot {
  id: string;
  domain: JobsNormalizationDomain;
  canonical: string;
  aliases: string[];
  aliasNormalized: string[];
  searchKeywords: string[];
  searchNormalized: string[];
  level: string | null;
  sortOrder: number;
  region?: string | null;
  intendedProvince?: string | null;
}

export interface NormalizationDomainSnapshot {
  terms: NormalizationTermSnapshot[];
  lookupMap: Map<string, NormalizationTermSnapshot>;
  canonicalMap: Map<string, NormalizationTermSnapshot>;
}

export interface NormalizedPreferenceKeyword {
  raw: string;
  canonicalId?: string;
  canonical: string;
  aliases: string[];
  aliasNormalized: string[];
  searchKeywords: string[];
  searchNormalized: string[];
  matched: boolean;
}

export interface LocationPreferenceKeyword {
  raw: string;
  canonical: string;
  aliases: string[];
  kind: JobsLocationKind;
  parentProvince?: string | null;
  parentProvinceAliases: string[];
  siblingCityKeywords: string[];
}

export interface LocationAliasEntry {
  canonical: string;
  aliases: string[];
}

export interface LocationDictionarySnapshot {
  aliasEntries: LocationAliasEntry[];
  cityParentProvinceMap: Record<string, string>;
}

export interface LocationMatchResult {
  exactMatches: string[];
  parentMatches: string[];
  excludedBySiblingCity: string[];
}

export interface JobsNormalizationSnapshot {
  domains: Record<JobsNormalizationDomain, NormalizationDomainSnapshot>;
  locationDictionary: LocationDictionarySnapshot;
}
