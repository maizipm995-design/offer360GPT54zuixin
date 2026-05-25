import dynamic from 'next/dynamic';
import type { Metadata } from 'next';
import { SitePageSkeleton } from '@/components/layout/site-page-skeleton';
import { buildPageMetadata } from '@/lib/seo';

const ResumeEditorPageClient = dynamic(
  () => import('@/components/resume/resume-editor-page-client').then((mod) => mod.ResumeEditorPageClient),
  {
    loading: () => <SitePageSkeleton compact />,
  },
);

export const metadata: Metadata = buildPageMetadata({
  title: '简历AI优化_大学生校招简历修改与润色工具',
  description: 'Offer360 简历AI优化工作台，支持大学生与应届生进行简历编辑、内容优化与表达润色。',
  path: '/resume-optimizer',
  robots: {
    index: false,
    follow: false,
  },
});

export default function ResumeOptimizerPage() {
  return <ResumeEditorPageClient />;
}
