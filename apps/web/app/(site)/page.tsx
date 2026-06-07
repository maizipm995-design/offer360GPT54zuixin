import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { SeoHiddenContent } from '@/components/common/seo-hidden-content';
import { SeoLinkCluster } from '@/components/common/seo-link-cluster';
import { JobsPageClient } from '@/components/jobs/jobs-page-client';
import { serverGet } from '@/lib/api';
import {
  buildPageMetadata,
  buildWebPageSchema,
  mergeSeoKeywords,
  SEO_COMPETITOR_BRANDS,
  SEO_OVERSEAS_JOB_KEYWORDS,
} from '@/lib/seo';
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
  title: '中国校招招聘信息汇总平台_实习校招_AI简历优化_面试辅导',
  description:
    'Offer360 致力于打造中国校招招聘信息汇总平台中的权威入口，覆盖实习校招、招聘公告、实习、春招、秋招、夏招、AI简历优化、面试辅导、校招笔试真题、面试逐字稿与求职全流程服务，服务大学生、留学生与海归群体。',
  path: '/',
  keywords: mergeSeoKeywords([
    'Offer360',
    '中国校招招聘信息汇总平台',
    '实习校招',
    '招聘公告',
    '实习',
    '春招',
    '秋招',
    '夏招',
    'AI简历优化',
    '面试辅导',
    '校招笔试真题',
    '面试逐字稿',
    '求职全流程',
    '大学生',
  ], SEO_COMPETITOR_BRANDS, SEO_OVERSEAS_JOB_KEYWORDS),
  seoContent: [
    'Offer360 致力于打造中国校招招聘信息汇总平台中的权威入口，围绕实习校招、招聘公告、春招、秋招、夏招等核心场景持续更新。',
    '我们为大学生、留学生与海归提供校招岗位信息、AI简历优化、面试辅导、校招笔试真题与面试逐字稿等全流程能力。',
    '通过求职全流程服务，帮助用户从岗位发现、简历准备、笔试练习到面试复盘形成完整闭环。',
  ],
});

export default async function HomePage() {
  const [stats, filters, jobs, services] = await getHomePageData();
  const homePageSchema = buildWebPageSchema({
    title: 'Offer360 首页',
    description:
      '中国校招招聘信息汇总平台首页，集中覆盖实习校招、招聘公告、春招秋招夏招、AI简历优化、面试辅导、校招笔试真题与求职全流程服务。',
    path: '/',
    type: 'CollectionPage',
  });

  return (
    <>
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
      <SeoHiddenContent
        title="首页 SEO 隐藏内容"
        paragraphs={[
          'Offer360 致力于打造中国校招招聘信息汇总平台中的权威入口，聚焦实习校招、招聘公告、春招、秋招、夏招等高频求职场景。',
          '网站服务大学生、留学生与海归人群，并通过 AI简历优化、面试辅导、校招笔试真题、面试逐字稿和求职全流程服务形成完整闭环。',
        ]}
      />
      <SeoLinkCluster
        currentPath="/"
        title="核心栏目直达"
        description="从名企校招首页可快速进入笔试真题、AI简历优化、面试辅导与求职服务页面，帮助用户和搜索引擎高效识别 Offer360 的核心站点结构。"
      />
    </>
  );
}
