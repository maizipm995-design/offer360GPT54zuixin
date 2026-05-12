import type { Metadata } from 'next';
import { JobsPageClient } from '@/components/jobs/jobs-page-client';
import { serverGet } from '@/lib/api';
import { buildOrganizationSchema, buildPageMetadata, buildWebsiteSchema } from '@/lib/seo';
import type { JobFilters, JobListResponse, JobStats, ServiceItem } from '@/types';

export const metadata: Metadata = buildPageMetadata({
  title: '2026-2027届校招信息汇总_大学生应届生求职实习招聘平台',
  description:
    'offer360专注大学生应届生求职，实时汇总2026-2027届春招秋招、国企大厂实习、内推网申信息，每日更新互联网、央企、名企校招岗位。',
  path: '/',
  keywords: ['2026届校招', '2027届秋招', '大学生求职', '应届生招聘', '实习岗位', '国企招聘', '大厂校招', '内推网申'],
});

export default async function HomePage() {
  const [stats, filters, jobs, services] = await Promise.all([
    serverGet<JobStats>('/dashboard/job-stats'),
    serverGet<JobFilters>('/jobs/filters'),
    serverGet<JobListResponse>('/jobs'),
    serverGet<ServiceItem[]>('/service-products'),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildOrganizationSchema()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildWebsiteSchema()) }}
      />
      <JobsPageClient
        initialStats={stats}
        initialFilters={filters}
        initialJobs={jobs}
        serviceProducts={services.slice(0, 4)}
      />
    </>
  );
}
