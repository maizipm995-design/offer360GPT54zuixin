import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { serverGet } from '@/lib/api';
import { buildPageMetadata, buildWebPageSchema } from '@/lib/seo';
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
  description: 'Offer360 提供大学生校招攻略与成长路径内容，覆盖校招节奏理解、简历准备、笔试面试方法与求职策略梳理。',
  path: '/career-journey',
  keywords: ['求职之路', '求职攻略', '校招攻略', '大学生求职', '应届生求职', '校招路径', '面试技巧', '笔试技巧'],
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
      <main className="mx-auto max-w-[1100px] px-4 py-8 lg:px-8">
        <section className="mb-6 rounded-[32px] bg-white px-5 py-8 shadow-card lg:px-10 lg:py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">校招攻略与成长路径</p>
          <h1 className="mt-3 text-3xl font-bold text-ink lg:text-4xl">从校招认知到简历、笔试、面试，系统梳理大学生求职之路</h1>
          <p className="mt-4 text-sm leading-7 text-muted lg:text-base">
            这里聚焦大学生和应届生在校招过程中的关键节点，帮助你系统理解求职节奏、准备重点和成长路径，
            让校招信息获取、简历准备、笔试面试与后续求职动作形成完整闭环。
          </p>
        </section>
        <section className="rounded-[32px] bg-white px-5 py-8 shadow-card lg:px-10 lg:py-10">
          <div className="rich-html-content" dangerouslySetInnerHTML={{ __html: content.htmlContent }} />
        </section>
      </main>
    </>
  );
}
