import type { Metadata } from 'next';
import { serverGet } from '@/lib/api';
import { buildPageMetadata } from '@/lib/seo';
import { CareerJourneyContent } from '@/types';

export const metadata: Metadata = buildPageMetadata({
  title: '求职之路_大学生校招求职攻略与成长路径',
  description: 'offer360 提供大学生校招求职攻略与成长路径内容，帮助应届生理解校招节奏、求职路径与成长策略。',
  path: '/career-journey',
  keywords: ['求职之路', '求职攻略', '校招攻略', '大学生求职', '应届生求职', '校招路径'],
});

export default async function CareerJourneyPage() {
  const content = await serverGet<CareerJourneyContent>('/membership-page/career-journey');

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-8 lg:px-8">
      <section className="rounded-[32px] bg-white px-5 py-8 shadow-card lg:px-10 lg:py-10">
        <div className="rich-html-content" dangerouslySetInnerHTML={{ __html: content.htmlContent }} />
      </section>
    </main>
  );
}
