import nextDynamic from 'next/dynamic';
import type { Metadata } from 'next';
import { SitePageSkeleton } from '@/components/layout/site-page-skeleton';
import { buildPageMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

const InterviewTranscriptPageClient = nextDynamic(
  () => import('@/components/interview/interview-transcript-page-client').then((mod) => mod.InterviewTranscriptPageClient),
  {
    loading: () => <SitePageSkeleton />,
  },
);

export const metadata: Metadata = buildPageMetadata({
  title: '面试逐字稿生成_面试复盘与回答优化工具',
  description: 'Offer360 面试逐字稿生成页，支持大学生与应届生完成面试内容沉淀、逐字稿生成与后续复盘优化。',
  path: '/interview-transcript',
  robots: {
    index: false,
    follow: false,
  },
});

export default function InterviewTranscriptPage() {
  return <InterviewTranscriptPageClient />;
}
