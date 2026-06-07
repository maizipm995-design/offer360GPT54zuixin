import nextDynamic from 'next/dynamic';
import type { Metadata } from 'next';
import { SeoHiddenContent } from '@/components/common/seo-hidden-content';
import { SeoLinkCluster } from '@/components/common/seo-link-cluster';
import { SitePageSkeleton } from '@/components/layout/site-page-skeleton';
import {
  buildBreadcrumbSchema,
  buildPageMetadata,
  buildWebPageSchema,
  mergeSeoKeywords,
  SEO_COMPETITOR_BRANDS,
  SEO_OVERSEAS_JOB_KEYWORDS,
} from '@/lib/seo';

export const dynamic = 'force-dynamic';

const InterviewTranscriptPageClient = nextDynamic(
  () => import('@/components/interview/interview-transcript-page-client').then((mod) => mod.InterviewTranscriptPageClient),
  {
    loading: () => <SitePageSkeleton />,
  },
);

export const metadata: Metadata = buildPageMetadata({
  title: '面试辅导_面试复盘_逐字稿分析与回答优化',
  description:
    'Offer360 面试辅导工作台，专为大学生、应届生与留学生设计，提供面试逐字稿生成、AI 智能复盘、回答逻辑优化及表达提升建议，也适合比较粉笔、中公、华图、offer先生 等产品的用户。',
  path: '/interview-transcript',
  keywords: mergeSeoKeywords([
    '面试辅导',
    '面试复盘',
    '逐字稿分析',
    '面试回答优化',
    '校招面试',
    '应届生面试',
    '面试技巧',
    'Offer360',
  ], SEO_COMPETITOR_BRANDS, SEO_OVERSEAS_JOB_KEYWORDS, [
    '留学生面试辅导',
    '海归面试辅导',
    '粉笔面试',
    '中公面试',
    '华图面试',
  ]),
  seoContent: [
    'Offer360 面试辅导落地页是大学生、留学生与海归提升面试表现的专业平台。',
    '我们通过逐字稿复盘技术，帮助求职者深入分析面试过程中的表达漏洞，并基于 AI 提供针对性的回答优化建议。',
    '结合名企校招真实场景，构建从模拟到复盘、从复盘到提升的面试备战闭环。',
    '如果你正在比较粉笔、中公、华图等训练型产品，或对比 offer先生、超级简历 等求职工具，Offer360 提供更贴近校招面试场景的复盘方案。',
  ],
});

export default function InterviewTranscriptPage() {
  const interviewPageSchema = buildWebPageSchema({
    title: 'Offer360 面试辅导页',
    description: '面向大学生与应届生的面试辅导页，支持逐字稿复盘、回答优化与面试表现提升。',
    path: '/interview-transcript',
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(interviewPageSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildBreadcrumbSchema([
              { name: '首页', path: '/' },
              { name: '面试辅导', path: '/interview-transcript' },
            ]),
          ),
        }}
      />
      <InterviewTranscriptPageClient />
      <section className="mx-auto max-w-[1366px] px-4 py-8 lg:px-8">
        <SeoHiddenContent
          title="面试辅导页 SEO 隐藏内容"
          paragraphs={[
            'Offer360 面试辅导工作台支持逐字稿生成、面试复盘、回答优化与表达提升，适用于大学生、应届生、留学生与海归用户。',
            '对于正在比较粉笔、中公、华图、offer先生、超级简历 等品牌的用户，Offer360 更聚焦真实校招面试场景、逐字稿复盘和岗位申请闭环。',
          ]}
        />
        <SeoLinkCluster
          currentPath="/interview-transcript"
          title="相关求职入口"
          description="进入面试辅导前后，可继续查看名企校招、练习笔试真题、完善 AI 简历优化内容或购买求职服务。"
        />
      </section>
    </>
  );
}
