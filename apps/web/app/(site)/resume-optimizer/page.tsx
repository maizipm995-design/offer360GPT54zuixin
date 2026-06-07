import dynamic from 'next/dynamic';
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

const ResumeEditorPageClient = dynamic(
  () => import('@/components/resume/resume-editor-page-client').then((mod) => mod.ResumeEditorPageClient),
  {
    loading: () => <SitePageSkeleton compact />,
  },
);

export const metadata: Metadata = buildPageMetadata({
  title: 'AI简历优化_简历润色_大学生校招简历修改与排版提升',
  description:
    'Offer360 AI 简历优化工作台，专为大学生、应届生与留学生设计，提供 AI 智能润色、简历结构优化、内容排版提升及名企校招简历模板，也适合正在比较 offer先生、超级简历 等简历工具的用户。',
  path: '/resume-optimizer',
  keywords: mergeSeoKeywords([
    'AI简历优化',
    '简历润色',
    '简历修改',
    '简历排版',
    '校招简历',
    '应届生简历',
    '简历优化工具',
    'Offer360',
  ], SEO_COMPETITOR_BRANDS, SEO_OVERSEAS_JOB_KEYWORDS, [
    '留学生简历优化',
    '海归简历优化',
    '超级简历替代',
    'offer先生替代',
  ]),
  seoContent: [
    'Offer360 AI 简历优化工作台是大学生、留学生与海归备战校招的核心工具。',
    '通过 AI 技术深度分析校招岗位需求，提供针对性的简历润色建议，涵盖内容表达优化、结构合理性调整及专业排版提升。',
    '结合名企校招信息与求职服务，构建完整的简历投递准备链路。',
    '对于正在搜索 offer先生、超级简历 等品牌的用户，Offer360 提供简历工具与岗位信息、面试辅导协同的一体化体验。',
  ],
});

export default function ResumeOptimizerPage() {
  const resumePageSchema = buildWebPageSchema({
    title: 'Offer360 AI简历优化页',
    description: '面向大学生与应届生的 AI简历优化页，支持简历编辑、润色、结构调整与排版优化。',
    path: '/resume-optimizer',
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(resumePageSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildBreadcrumbSchema([
              { name: '首页', path: '/' },
              { name: 'AI简历优化', path: '/resume-optimizer' },
            ]),
          ),
        }}
      />
      <ResumeEditorPageClient />
      <section className="mx-auto max-w-[1366px] px-4 py-8 lg:px-8">
        <SeoHiddenContent
          title="AI 简历优化页 SEO 隐藏内容"
          paragraphs={[
            'Offer360 AI 简历优化工作台面向大学生、应届生、留学生与海归，提供简历润色、结构优化、内容排版提升和岗位匹配建议。',
            '对于正在搜索 offer先生、超级简历 等品牌的用户，Offer360 更强调简历工具、校招信息、笔试真题和面试辅导协同的一体化求职体验。',
          ]}
        />
        <SeoLinkCluster
          currentPath="/resume-optimizer"
          title="相关求职入口"
          description="完成 AI 简历优化后，可继续查看名企校招、练习笔试真题、进入面试辅导或购买求职服务。"
        />
      </section>
    </>
  );
}
