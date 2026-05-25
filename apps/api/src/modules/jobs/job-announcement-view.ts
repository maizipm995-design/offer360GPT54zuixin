import { Prisma } from '@prisma/client';
import { formatDateOnly } from '../../common/utils/job-text-date';
import { isWithinDays, isWithinHours } from './jobs.utils';

type JobAnnouncementBasePayload = Prisma.JobAnnouncementGetPayload<{}>;
type JobAnnouncementTrackingItem = { progressStatus: string };

export type JobAnnouncementViewPayload = JobAnnouncementBasePayload & { trackings?: JobAnnouncementTrackingItem[] };
type JobCardAccessState = {
  canViewAnnouncement?: boolean;
  canDeliver?: boolean;
};

const BLOCKED_TARGET_VALUES = new Set(['#', '/', 'javascript:void(0)', 'javascript:;', 'about:blank']);
const BLOCKED_TARGET_HOSTNAMES = new Set(['example.com', 'www.example.com', 'localhost', '127.0.0.1', '0.0.0.0']);
const BARE_DOMAIN_PATTERN = /^(?:www\.)?[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?:[/:?#].*)?$/i;
const EMAIL_ADDRESS_EXTRACT_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

function normalizeTargetValue(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  const lowered = normalized.toLowerCase();
  if (BLOCKED_TARGET_VALUES.has(lowered)) {
    return null;
  }

  return normalized;
}

function normalizeExternalUrl(value?: string | null) {
  const normalized = normalizeTargetValue(value);
  if (!normalized) {
    return null;
  }

  let candidate = normalized;
  if (candidate.startsWith('//')) {
    candidate = `https:${candidate}`;
  } else if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate) && BARE_DOMAIN_PATTERN.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    if (BLOCKED_TARGET_HOSTNAMES.has(parsed.hostname.toLowerCase())) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeEmailTarget(value?: string | null) {
  const normalized = normalizeTargetValue(value);
  if (!normalized) {
    return null;
  }

  const candidate = normalized.toLowerCase().startsWith('mailto:')
    ? normalized.slice('mailto:'.length).trim()
    : normalized;

  const matchedEmail = candidate.match(EMAIL_ADDRESS_EXTRACT_PATTERN)?.[0];
  if (matchedEmail) {
    return matchedEmail;
  }

  return candidate.includes('@') ? candidate : null;
}

function resolveDeliveryMethod(deliveryUrl?: string | null) {
  if (normalizeEmailTarget(deliveryUrl)) {
    return 'email';
  }
  return normalizeExternalUrl(deliveryUrl) ? 'website' : null;
}

function buildJobDisplayName(job: Pick<JobAnnouncementViewPayload, 'jobName' | 'announcementTitle'>) {
  return job.jobName?.trim() || job.announcementTitle?.trim() || '未命名岗位';
}

function resolveDisplayEntryDate(job: Pick<JobAnnouncementViewPayload, 'entryDate' | 'updatedAt'>) {
  if (job.entryDate?.trim()) {
    return job.entryDate.trim();
  }

  return formatDateOnly(job.updatedAt);
}

function resolveFreshnessReferenceDate(job: Pick<JobAnnouncementViewPayload, 'entryDate' | 'updatedAt'>) {
  const parsed = new Date(resolveDisplayEntryDate(job));
  return Number.isNaN(parsed.getTime()) ? job.updatedAt : parsed;
}

export function buildLegacyJobCard(
  job: JobAnnouncementViewPayload,
  extras?: {
    recommendReasons?: string[];
    recommendMeta?: {
      hitDimensions: Array<'company' | 'job' | 'location' | 'degree' | 'major' | 'freshness' | 'heat' | 'fallback'>;
      version: string;
      matchTier?: 0 | 1 | 2 | 3;
      matchType?: 'CITY_JOB_COMPANY' | 'CITY_COMPANY' | 'CITY_JOB' | 'JOB_COMPANY' | 'CITY_ONLY' | 'JOB_ONLY' | 'COMPANY_ONLY' | 'FALLBACK';
    };
    access?: JobCardAccessState;
  },
) {
  const tracking = job.trackings?.[0];
  const announcementUrl = resolveValidAnnouncementUrl(job.announcementUrl);
  const deliveryTarget = resolveValidDeliveryTarget(job.deliveryUrl);
  const deliveryMethod = resolveDeliveryMethod(deliveryTarget);
  const jobName = job.jobName?.trim() || null;
  const majorRequirement = job.majorRequirement?.trim() || null;
  const recruitmentType = job.recruitmentType?.trim() || null;
  const companyFullName = job.companyFullName?.trim() || '';
  const hasAnnouncement = Boolean(announcementUrl);
  const hasDelivery = Boolean(deliveryTarget);

  return {
    id: job.id,
    companyFullName,
    companyName: companyFullName,
    jobName,
    positionNames: buildJobDisplayName(job),
    workLocation: job.workLocation,
    degreeRequirement: job.degreeRequirement,
    enterpriseNature: job.enterpriseNature,
    recruitmentType,
    jobType: recruitmentType,
    majorRequirement,
    deadlineAt: job.deadlineAt,
    hasAnnouncement,
    canViewAnnouncement: hasAnnouncement && Boolean(extras?.access?.canViewAnnouncement),
    deliveryType: deliveryMethod,
    hasDelivery,
    canDeliver: hasDelivery && Boolean(extras?.access?.canDeliver),
    announcementTitle: job.announcementTitle,
    industry: job.industry,
    graduationSession: job.graduationSession,
    entryDate: resolveDisplayEntryDate(job),
    updatedAt: job.updatedAt,
    createdAt: job.createdAt,
    hasReferral: Boolean(job.referralCode),
    accessClickCount: job.accessClickCount,
    deliveryMarkCount: job.deliveryMarkCount,
    isLatest: isWithinHours(resolveFreshnessReferenceDate(job), 24),
    isUrgent: job.deadlineAt ? isWithinDays(job.deadlineAt, 7) : false,
    currentProgress: tracking?.progressStatus ?? '未标记',
    recommendReasons: extras?.recommendReasons,
    recommendMeta: extras?.recommendMeta,
  };
}

export function buildJobKeywordText(job: Pick<JobAnnouncementViewPayload, 'jobName' | 'announcementTitle'>) {
  return `${job.jobName || ''} ${job.announcementTitle || ''}`.toLowerCase();
}

export function buildJobSupplementText(job: Pick<JobAnnouncementViewPayload, 'majorRequirement' | 'announcementTitle' | 'industry' | 'graduationSession'>) {
  return `${job.majorRequirement || ''} ${job.announcementTitle || ''} ${job.industry || ''} ${job.graduationSession || ''}`.toLowerCase();
}

export function resolveValidAnnouncementUrl(announcementUrl?: string | null) {
  return normalizeExternalUrl(announcementUrl);
}

export function resolveValidDeliveryTarget(deliveryUrl?: string | null) {
  return normalizeEmailTarget(deliveryUrl) ?? normalizeExternalUrl(deliveryUrl);
}

export function resolveJobDeliveryMethod(deliveryUrl?: string | null) {
  return resolveDeliveryMethod(deliveryUrl);
}
