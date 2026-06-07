import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { SeoHiddenContent } from '@/components/common/seo-hidden-content';
import { SeoLinkCluster } from '@/components/common/seo-link-cluster';
import { serverGet } from '@/lib/api';
import { buildBreadcrumbSchema, buildPageMetadata, buildWebPageSchema, mergeSeoKeywords, SEO_OVERSEAS_JOB_KEYWORDS } from '@/lib/seo';
import { CareerJourneyContent } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 1800;

const getCareerJourneyPageData = unstable_cache(
  async () => serverGet<CareerJourneyContent>('/membership-page/career-journey'),
  ['site-career-journey-page'],
  { revalidate },
);

export const metadata: Metadata = buildPageMetadata({
  title: '求职之路_大学生校招攻略_简历面试笔试成长路径',
  description: 'Offer360 提供大学生、留学生与海归求职群体的校招攻略与成长路径内容，覆盖实习校招、招聘公告、春招、秋招、夏招、简历准备、校招笔试真题、面试辅导与求职策略梳理。',
  path: '/career-journey',
  keywords: mergeSeoKeywords([
    '求职之路',
    '求职攻略',
    '校招攻略',
    '实习校招',
    '招聘公告',
    '春招',
    '秋招',
    '夏招',
    '大学生求职',
    '应届生求职',
    '校招路径',
    '面试技巧',
    '笔试技巧',
    '校招笔试真题',
  ], SEO_OVERSEAS_JOB_KEYWORDS, [
    '留学生求职攻略',
    '海归求职攻略',
  ]),
});

export default async function CareerJourneyPage() {
  const content = await getCareerJourneyPageData();
  const careerJourneySchema = buildWebPageSchema({
    title: 'Offer360 求职之路',
    description: '大学生校招求职攻略与成长路径页面，帮助用户系统理解校招节奏、简历准备、笔试面试与求职策略。',
    path: '/career-journey',
    type: 'AboutPage',
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(careerJourneySchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildBreadcrumbSchema([
              { name: '首页', path: '/' },
              { name: '求职之路', path: '/career-journey' },
            ]),
          ),
        }}
      />
      <main className="mx-auto max-w-[1100px] px-4 py-8 lg:px-8">
        <section className="rounded-[32px] bg-white px-5 py-8 shadow-card lg:px-10 lg:py-10">
          <div className="rich-html-content" dangerouslySetInnerHTML={{ __html: content.htmlContent }} />
        </section>
        <SeoHiddenContent
          title="求职之路页 SEO 隐藏内容"
          paragraphs={[
            'Offer360 求职之路页面围绕大学生、留学生与海归用户的校招攻略、实习校招、招聘公告、春招、秋招、夏招、笔试准备和面试提升等内容进行补充说明。',
            '该页面作为辅助内容入口，与名企校招、校招笔试真题、AI 简历优化、面试辅导和求职服务形成完整内链闭环。',
          ]}
        />
        <SeoLinkCluster
          className="mt-6"
          currentPath="/career-journey"
          title="相关求职入口"
          description="从求职路径页可继续进入名企校招、笔试真题、AI 简历优化、面试辅导和求职服务页面，形成完整的求职准备闭环。"
        />
      </main>
    </>
  );
}
