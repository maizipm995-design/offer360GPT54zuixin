import { notFound } from 'next/navigation';
import { CampusExamQuestionPageClient } from '@/components/campus-exam/campus-exam-question-page-client';
import { SeoHiddenContent } from '@/components/common/seo-hidden-content';
import { getCampusExamQuestionDetail } from '@/lib/campus-exam-page-data';
import {
  buildBreadcrumbSchema,
  buildWebPageSchema,
  mergeSeoKeywords,
  SEO_OVERSEAS_JOB_KEYWORDS,
} from '@/lib/seo';

export const revalidate = 300;

export default async function CampusExamQuestionPage({
  params,
  searchParams,
}: {
  params: Promise<{ questionId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { questionId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const rawSessionId = resolvedSearchParams.sessionId;
  const sessionId = typeof rawSessionId === 'string' ? rawSessionId : Array.isArray(rawSessionId) ? rawSessionId[0] : null;

  try {
    const data = await getCampusExamQuestionDetail(questionId);
    const categoryName = data.special?.category?.name;
    const categorySlug = data.special?.category?.slug;
    const specialName = data.special?.name;
    const specialPath = data.special?.id ? `/campus-exam/special/${encodeURIComponent(String(data.special.id))}` : null;
    const questionPath = `/campus-exam/question/${encodeURIComponent(questionId)}`;
    const stemPreviewText = extractPlainText(data.stemPreviewHtml, 160);
    const analysisPreviewText = extractPlainText(data.analysisPreviewHtml, 180);
    const pageSchema = buildWebPageSchema({
      title: `${specialName ?? '校招笔试'} ${data.questionTypeLabel} 标准答案与解析 - Offer360`,
      description: `Offer360 提供${categoryName ? `${categoryName}分类` : '校招笔试'}${specialName ? `${specialName}专项` : ''}的${data.questionTypeLabel}真题解析，包含标准答案、解析与专项刷题入口。`,
      path: questionPath,
    });
    const breadcrumbItems = [
      { name: '首页', path: '/' },
      { name: '笔试真题', path: '/campus-exam' },
    ];
    if (categoryName && categorySlug) {
      breadcrumbItems.push({
        name: categoryName,
        path: `/campus-exam/category/${encodeURIComponent(categorySlug)}`,
      });
    }
    if (specialName && specialPath) {
      breadcrumbItems.push({
        name: specialName,
        path: specialPath,
      });
    }
    breadcrumbItems.push({ name: '题目详情', path: questionPath });

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBreadcrumbSchema(breadcrumbItems)) }}
        />
        <CampusExamQuestionPageClient initialData={data} questionId={questionId} sessionId={sessionId} />
        <SeoHiddenContent
          title={`${specialName ?? '校招笔试'}题目详情 SEO 摘要`}
          paragraphs={[
            `${categoryName ? `${categoryName} 分类下的` : ''}${specialName ? `${specialName} 专项` : '校招笔试'}${data.questionTypeLabel}题目详情页提供标准答案、答案解析与专项刷题入口，适合大学生、留学生与海归备战实习校招。`,
            stemPreviewText ? `题干摘要：${stemPreviewText}` : '',
            analysisPreviewText ? `解析摘要：${analysisPreviewText}` : '',
          ].filter(Boolean)}
          keywords={mergeSeoKeywords(
            [
              specialName,
              categoryName,
              data.questionTypeLabel,
              `${data.questionTypeLabel}标准答案`,
              `${data.questionTypeLabel}解析`,
              `${specialName ?? '校招笔试'}${data.questionTypeLabel}`,
              '校招笔试真题',
              '实习校招',
              '大学生',
              '留学生',
              '海归',
              data.isHighFrequencyWrong ? '高频错题' : undefined,
            ],
            SEO_OVERSEAS_JOB_KEYWORDS,
          )}
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

function extractPlainText(html: string | undefined | null, maxLength: number) {
  if (!html) {
    return '';
  }

  const plainText = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

  if (plainText.length <= maxLength) {
    return plainText;
  }

  return `${plainText.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}
