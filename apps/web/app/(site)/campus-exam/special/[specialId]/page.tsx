import { notFound } from 'next/navigation';
import { CampusExamSpecialPageClient } from '@/components/campus-exam/campus-exam-special-page-client';
import { SeoHiddenContent } from '@/components/common/seo-hidden-content';
import { getCampusExamSpecialDetail } from '@/lib/campus-exam-page-data';
import {
  buildBreadcrumbSchema,
  buildWebPageSchema,
  mergeSeoKeywords,
  SEO_OVERSEAS_JOB_KEYWORDS,
} from '@/lib/seo';

export const revalidate = 300;

export default async function CampusExamSpecialPage({
  params,
}: {
  params: Promise<{ specialId: string }>;
}) {
  const { specialId } = await params;

  try {
    const data = await getCampusExamSpecialDetail(specialId);
    const path = `/campus-exam/special/${encodeURIComponent(String(data.id))}`;
    const questionTypeSummary = data.questionTypeDistribution
      .filter((item) => item.count > 0)
      .slice(0, 4)
      .map((item) => `${item.label}${item.count}题`)
      .join('、');
    const difficultySummary = data.difficultyDistribution
      .filter((item) => item.count > 0)
      .slice(0, 4)
      .map((item) => `难度${item.difficulty}${item.count}题`)
      .join('、');
    const pageSchema = buildWebPageSchema({
      title: `${data.name}专项练习 - Offer360`,
      description: data.description?.trim()
        ? `${data.description.trim()}，包含 ${data.questionCount} 道题与标准答案解析。`
        : `Offer360 ${data.name} 专项提供 ${data.questionCount} 道练习题，覆盖校招笔试真题、答案解析与专项刷题。`,
      path,
      type: 'CollectionPage',
    });
    const breadcrumbSchema = buildBreadcrumbSchema([
      { name: '首页', path: '/' },
      { name: '笔试真题', path: '/campus-exam' },
      { name: data.category.name, path: `/campus-exam/category/${encodeURIComponent(data.category.slug)}` },
      { name: data.name, path },
    ]);
    const seoKeywords = mergeSeoKeywords(
      [
        data.name,
        `${data.name}真题`,
        `${data.name}专项练习`,
        `${data.category.name}题库`,
        `${data.category.name}笔试真题`,
        '校招笔试真题',
        '实习校招',
        '求职全流程',
        '大学生',
        '留学生',
        '海归',
      ],
      SEO_OVERSEAS_JOB_KEYWORDS,
    );

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        />
        <CampusExamSpecialPageClient initialData={data} specialId={specialId} />
        <SeoHiddenContent
          title={`${data.name} 专项页 SEO 摘要`}
          paragraphs={[
            `${data.name} 是 ${data.category.name} 分类下的专项练习页，当前提供 ${data.questionCount} 道校招笔试真题，覆盖标准答案、题目解析与顺序刷题入口。`,
            questionTypeSummary
              ? `${data.name} 题型分布包括 ${questionTypeSummary}，帮助大学生、留学生与海归围绕实习校招场景进行专项强化。`
              : `${data.name} 专项持续承接校招笔试真题、专项刷题与题目解析等深层搜索需求。`,
            difficultySummary ? `${data.name} 当前难度分布为 ${difficultySummary}。` : '',
          ].filter(Boolean)}
          keywords={seoKeywords}
        />
      </>
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('不存在')) {
      notFound();
    }
    throw error;
  }
}
