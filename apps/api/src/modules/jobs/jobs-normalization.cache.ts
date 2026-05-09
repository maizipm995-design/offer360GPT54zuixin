import { JobsNormalizationSnapshot } from './jobs-normalization.types';

const JOBS_NORMALIZATION_CACHE_TTL_MS = 10 * 60 * 1000;

let normalizationSnapshotCache: { expiresAt: number; value: JobsNormalizationSnapshot } | null = null;

export function getJobsNormalizationCache() {
  if (!normalizationSnapshotCache) {
    return null;
  }
  if (normalizationSnapshotCache.expiresAt <= Date.now()) {
    normalizationSnapshotCache = null;
    return null;
  }
  return normalizationSnapshotCache.value;
}

export function setJobsNormalizationCache(value: JobsNormalizationSnapshot) {
  normalizationSnapshotCache = {
    expiresAt: Date.now() + JOBS_NORMALIZATION_CACHE_TTL_MS,
    value,
  };
}

export function clearJobsNormalizationCache() {
  normalizationSnapshotCache = null;
}
