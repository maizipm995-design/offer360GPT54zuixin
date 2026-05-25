import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { JobsPageClient } from '@/components/jobs/jobs-page-client';
import { serverGet } from '@/lib/api';
import { buildOrganizationSchema, buildPageMetadata, buildWebPageSchema, buildWebsiteSchema } from '@/lib/seo';
import type { JobFilters, JobListResponse, JobStats, ServiceItem } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

const getHomePageData = unstable_cache(
  async () => Promise.all([
    serverGet<JobStats>('/dashboard/job-stats'),
    serverGet<JobFilters>('/jobs/filters'),
    serverGet<JobListResponse>('/jobs?page=1&limit=6'),
    serverGet<ServiceItem[]>('/service-products'),
  ]),
  ['site-home-page'],
  { revalidate },
);

export const metadata: Metadata = buildPageMetadata({
  title: '中国校招招聘信息汇总平台_2026-2027届校招实习招聘_简历AI优化与求职服务',
  description:
    'Offer360 致力于打造中国校招招聘信息汇总平台中的权威入口，覆盖 2026-2027 届校招招聘信息、实习岗位、简历AI优化、面试辅导、笔试真题、面试逐字稿与求职全流程服务。',
  path: '/',
  keywords: ['中国校招招聘信息汇总平台', '2026届校招', '2027届秋招', '大学生求职', '应届生招聘', '实习岗位', '简历AI优化', '面试辅导', '笔试真题', '面试逐字稿'],
  seoContent: [
    'Offer360，聚焦中国校招招聘信息汇总与大学生求职全流程服务。',
    '我们以校招招聘信息实时汇总为核心，持续覆盖校招公告、实习岗位、简历AI优化、面试辅导、笔试真题、面试逐字稿与求职陪跑，帮助大学生和应届生更高效完成从投递到面试、从笔试到拿 offer 的完整求职流程。',
    '校招招聘信息实时汇总；覆盖 2026-2027 届校招与实习岗位；简历AI优化、面试辅导、笔试真题；面试逐字稿与求职全流程服务。',
  ],
});

export default async function HomePage() {
  const [stats, filters, jobs, services] = await getHomePageData();
  const homePageSchema = buildWebPageSchema({
    title: 'Offer360 首页',
    description:
      '中国校招招聘信息汇总平台首页，集中覆盖校招招聘信息、实习岗位、简历AI优化、面试辅导、笔试真题、面试逐字稿与求职全流程服务。',
    path: '/',
    type: 'CollectionPage',
  });

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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homePageSchema) }}
      />
      <JobsPageClient
        initialStats={stats}
        initialFilters={filters}
        initialJobs={jobs}
        initialJobsMode="sample"
        serviceProducts={services.slice(0, 4)}
      />
    </>
  );
}
