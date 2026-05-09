import { Prisma } from '@prisma/client';
import { formatDateOnly } from '../../common/utils/job-text-date';
import { isWithinDays, isWithinHours } from './jobs.utils';

type JobAnnouncementBasePayload = Prisma.JobAnnouncementGetPayload<{}>;
type JobAnnouncementTrackingItem = { progressStatus: string };

export type JobAnnouncementViewPayload = JobAnnouncementBasePayload & { trackings?: JobAnnouncementTrackingItem[] };

function resolveDeliveryMethod(deliveryUrl?: string | null) {
  if (!deliveryUrl) {
    return null;
  }

  const normalized = deliveryUrl.trim().toLowerCase();
  return normalized.includes('@') && !normalized.startsWith('http') ? 'email' : 'website';
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
  },
) {
  const tracking = job.trackings?.[0];
  const deliveryMethod = resolveDeliveryMethod(job.deliveryUrl);
  const jobName = job.jobName?.trim() || null;
  const jobCategory = job.jobCategory?.trim() || null;
  const recruitmentType = job.recruitmentType?.trim() || null;
  const companyFullName = job.companyFullName?.trim() || '';

  return {
    id: job.id,
    companyFullName,
    companyName: companyFullName,
    jobName,
    positionNames: buildJobDisplayName(job),
    jobCategory,
    positionCategory: jobCategory,
    workLocation: job.workLocation,
    degreeRequirement: job.degreeRequirement,
    enterpriseNature: job.enterpriseNature,
    recruitmentType,
    jobType: recruitmentType,
    majorRequirement: jobCategory,
    deadlineAt: job.deadlineAt,
    announcementUrl: job.announcementUrl,
    deliveryType: deliveryMethod,
    deliveryUrl: job.deliveryUrl,
    recruitmentLink: job.deliveryUrl,
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

export function buildJobKeywordText(job: Pick<JobAnnouncementViewPayload, 'jobCategory' | 'jobName' | 'announcementTitle'>) {
  return `${job.jobCategory || ''} ${job.jobName || ''} ${job.announcementTitle || ''}`.toLowerCase();
}

export function buildJobSupplementText(job: Pick<JobAnnouncementViewPayload, 'jobCategory' | 'announcementTitle' | 'industry' | 'graduationSession'>) {
  return `${job.jobCategory || ''} ${job.announcementTitle || ''} ${job.industry || ''} ${job.graduationSession || ''}`.toLowerCase();
}

export function resolveJobDeliveryMethod(deliveryUrl?: string | null) {
  return resolveDeliveryMethod(deliveryUrl);
}
