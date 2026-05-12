import type { Metadata } from 'next';
import { ResumeEditorPageClient } from '@/components/resume/resume-editor-page-client';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: '简历优化',
  description: 'offer360 简历编辑与优化工作台。',
  path: '/resume-optimizer',
  robots: {
    index: false,
    follow: false,
  },
});

export default function ResumeOptimizerPage() {
  return <ResumeEditorPageClient />;
}
