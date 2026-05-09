import type { JobAccessClickActionType } from './jobs-metrics.service';

export type RecommendationHitDimension = 'company' | 'job' | 'location' | 'degree' | 'major' | 'freshness' | 'heat' | 'fallback';
export type RecommendationMatchTier = 0 | 1 | 2 | 3;
export type RecommendationMatchType =
  | 'CITY_JOB_COMPANY'
  | 'CITY_COMPANY'
  | 'CITY_JOB'
  | 'JOB_COMPANY'
  | 'CITY_ONLY'
  | 'JOB_ONLY'
  | 'COMPANY_ONLY'
  | 'FALLBACK';
export type RecommendedFeedStateCode = 'DEFAULT' | 'PREFERENCE_REQUIRED' | 'NO_MATCHED_RESULT';
export type RecommendedFeedFallbackMode = 'HOT_JOBS';

export interface RecommendationReasonItem {
  label: string;
  weight: number;
  dimension: RecommendationHitDimension;
}

export interface RecommendationMeta {
  hitDimensions: RecommendationHitDimension[];
  version: string;
  matchTier?: RecommendationMatchTier;
  matchType?: RecommendationMatchType;
}

export interface RecommendationScoreResult {
  score: number;
  reasons: RecommendationReasonItem[];
  meta: RecommendationMeta;
}

export interface RecommendationCandidate {
  jobId: string;
  matchTier: RecommendationMatchTier;
  matchType: RecommendationMatchType;
  sourceOrder: number;
}

export interface RecommendationListMeta {
  stateCode: RecommendedFeedStateCode;
  stateMessage?: string;
  summaryText?: string;
  fallbackMode?: RecommendedFeedFallbackMode;
  hasPreferences: boolean;
}

export interface JobsRecommendationCachePayload<T = unknown> {
  expiresAt: number;
  value: T;
}

export interface LocationPreferenceKeyword {
  raw: string;
  canonical: string;
  kind: 'province' | 'city' | 'unknown';
  parentProvince?: string | null;
}

export interface LocationMatchResult {
  exactMatches: string[];
  parentMatches: string[];
}

export interface JobsClickDtoShape {
  actionType: JobAccessClickActionType;
}
