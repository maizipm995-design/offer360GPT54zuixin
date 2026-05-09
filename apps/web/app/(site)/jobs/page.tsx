import { JobsPageClient } from '@/components/jobs/jobs-page-client';
import { serverGet } from '@/lib/api';
import { JobFilters, JobListResponse, JobStats, ServiceItem } from '@/types';

export default async function JobsPage() {
  const [stats, filters, jobs, services] = await Promise.all([
    serverGet<JobStats>('/dashboard/job-stats'),
    serverGet<JobFilters>('/jobs/filters'),
    serverGet<JobListResponse>('/jobs'),
    serverGet<ServiceItem[]>('/service-products'),
  ]);

  return (
    <JobsPageClient
      initialStats={stats}
      initialFilters={filters}
      initialJobs={jobs}
      serviceProducts={services.slice(0, 4)}
    />
  );
}
