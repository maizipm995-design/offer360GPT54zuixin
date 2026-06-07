import { notFound } from 'next/navigation';
import { CampusExamCategoryPageClient } from '@/components/campus-exam/campus-exam-category-page-client';
import { SeoHiddenContent } from '@/components/common/seo-hidden-content';
import { getCampusExamCategoryDetail } from '@/lib/campus-exam-page-data';
import {
  buildBreadcrumbSchema,
  buildWebPageSchema,
  mergeSeoKeywords,
  SEO_OVERSEAS_JOB_KEYWORDS,
} from '@/lib/seo';

export const revalidate = 300;

export default async function CampusExamCategoryPage({
  params,
}: {
  params: Promise<{ categorySlug: string }>;
}) {
  const { categorySlug } = await params;

  try {
    const data = await getCampusExamCategoryDetail(categorySlug);
    const path = `/campus-exam/category/${encodeURIComponent(data.slug)}`;
    const specialNames = data.specials.slice(0, 6).map((special) => special.name);
    const pageSchema = buildWebPageSchema({
      title: `${data.name}笔试真题分类 - Offer360`,
      description: data.description?.trim()
        ? `${data.description.trim()}，页面聚合 ${data.specials.length} 个专项练习入口与题目解析资源。`
        : `Offer360 ${data.name} 分类页聚合 ${data.specials.length} 个专项练习入口，覆盖校招笔试真题、专项刷题和题目解析。`,
      path,
      type: 'CollectionPage',
    });
    const breadcrumbSchema = buildBreadcrumbSchema([
      { name: '首页', path: '/' },
      { name: '笔试真题', path: '/campus-exam' },
      { name: data.name, path },
    ]);
    const seoParagraphs = [
      `${data.name} 是 Offer360 校招笔试真题题库的重要分类页，当前聚合 ${data.specials.length} 个专项练习入口，覆盖校招笔试真题、专项刷题、标准答案与题目解析等核心搜索语义。`,
      specialNames.length
        ? `${data.name} 分类下的重点专项包括 ${specialNames.join('、')}，适合大学生、留学生与海归围绕实习校招场景做系统化练习。`
        : `${data.name} 分类页持续承接实习校招、校招笔试真题与求职全流程中的笔试备战需求。`,
    ];
    const seoKeywords = mergeSeoKeywords(
      [
        `${data.name}笔试真题`,
        `${data.name}题库`,
        `${data.name}专项练习`,
        data.name,
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
        <CampusExamCategoryPageClient data={data} />
        <SeoHiddenContent
          title={`${data.name} 分类页 SEO 摘要`}
          paragraphs={seoParagraphs}
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
