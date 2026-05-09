import { JOBS_RECOMMENDATION_CACHE_TTL_MS } from './jobs-recommendation.constants';
import type { JobsRecommendationCachePayload } from './jobs-recommendation.types';

const recommendationCache = new Map<string, JobsRecommendationCachePayload>();
const userCacheKeyMap = new Map<string, Set<string>>();

export function getJobsRecommendationCache<T>(cacheKey: string) {
  const cached = recommendationCache.get(cacheKey) as JobsRecommendationCachePayload<T> | undefined;
  if (!cached) {
    return null;
  }
  if (cached.expiresAt <= Date.now()) {
    recommendationCache.delete(cacheKey);
    return null;
  }
  return cached.value;
}

export function setJobsRecommendationCache<T>(userId: string, cacheKey: string, value: T) {
  recommendationCache.set(cacheKey, {
    expiresAt: Date.now() + JOBS_RECOMMENDATION_CACHE_TTL_MS,
    value,
  });
  const cacheKeys = userCacheKeyMap.get(userId) ?? new Set<string>();
  cacheKeys.add(cacheKey);
  userCacheKeyMap.set(userId, cacheKeys);
}

export function invalidateJobsRecommendationCacheByUserId(userId: string) {
  const cacheKeys = userCacheKeyMap.get(userId);
  if (!cacheKeys) {
    return;
  }
  cacheKeys.forEach((cacheKey) => recommendationCache.delete(cacheKey));
  userCacheKeyMap.delete(userId);
}

export function clearAllJobsRecommendationCache() {
  recommendationCache.clear();
  userCacheKeyMap.clear();
}

export function clearExpiredJobsRecommendationCache() {
  const now = Date.now();
  recommendationCache.forEach((value, cacheKey) => {
    if (value.expiresAt <= now) {
      recommendationCache.delete(cacheKey);
    }
  });
}
