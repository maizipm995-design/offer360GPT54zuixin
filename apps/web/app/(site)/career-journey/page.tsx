import { serverGet } from '@/lib/api';
import { CareerJourneyContent } from '@/types';

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
