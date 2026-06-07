import { unstable_cache } from 'next/cache';
import { CampusExamHomePageClient } from '@/components/campus-exam/campus-exam-home-page-client';
import { SeoHiddenContent } from '@/components/common/seo-hidden-content';
import { serverGet } from '@/lib/api';
import type { CampusExamHomePayload } from '@/lib/campus-exam';
import {
  buildBreadcrumbSchema,
  buildWebPageSchema,
  getAbsoluteUrl,
  mergeSeoKeywords,
  SEO_OVERSEAS_JOB_KEYWORDS,
} from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

const getCampusExamHomePageData = unstable_cache(
  async () => serverGet<CampusExamHomePayload>('/campus-exam/home'),
  ['site-campus-exam-home-page'],
  { revalidate },
);

export default async function CampusExamHomePage() {
  let initialData: CampusExamHomePayload | null = null;

  try {
    initialData = await getCampusExamHomePageData();
  } catch (error) {
    console.error('Failed to load campus exam home page data on server.', error);
  }

  const categoryNames = (initialData?.categoryTree ?? []).slice(0, 6).map((category) => category.name);
  const totalSpecialCount = (initialData?.categoryTree ?? []).reduce((sum, category) => sum + category.specials.length, 0);
  const totalQuestionCount = (initialData?.categoryTree ?? []).reduce(
    (sum, category) => sum + category.specials.reduce((specialSum, special) => specialSum + special.questionCount, 0),
    0,
  );
  const pageSchema = buildWebPageSchema({
    title: 'Offer360 笔试真题页',
    description: 'Offer360 笔试真题页聚合名企校招笔试分类、专项练习、题目解析、快速刷题与模考训练入口。',
    path: '/campus-exam',
    type: 'CollectionPage',
  });
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: '首页', path: '/' },
    { name: '笔试真题', path: '/campus-exam' },
  ]);
  const categoryListSchema = initialData?.categoryTree?.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Offer360 笔试真题分类列表',
        numberOfItems: initialData.categoryTree.length,
        itemListElement: initialData.categoryTree.map((category, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: category.name,
          url: getAbsoluteUrl(`/campus-exam/category/${encodeURIComponent(category.slug)}`),
          description: category.description || `${category.name} 分类下聚合专项练习与题目解析入口。`,
        })),
      }
    : null;

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
      {categoryListSchema ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(categoryListSchema) }}
        />
      ) : null}
      <CampusExamHomePageClient initialData={initialData} />
      <SeoHiddenContent
        title="笔试真题页 SEO 摘要"
        paragraphs={[
          `Offer360 笔试真题题库采用分类、专项、题目三级结构，当前聚合 ${initialData?.categoryTree.length ?? 0} 个分类、${totalSpecialCount} 个专项与 ${totalQuestionCount} 道题目入口，覆盖校招笔试真题、专项刷题、快速练习与模考训练。`,
          categoryNames.length
            ? `核心分类包括 ${categoryNames.join('、')}，适合大学生、应届生、留学生与海归围绕实习校招场景进行系统化笔试准备。`
            : '页面承接大学生、应届生、留学生与海归求职群体的笔试练习、专项刷题、模考训练和题目解析等搜索需求。',
        ]}
        keywords={mergeSeoKeywords(
          [
            '校招笔试真题',
            '笔试真题题库',
            '专项刷题',
            '实习校招',
            '求职全流程',
            '大学生',
            '留学生',
            '海归',
            ...categoryNames.map((name) => `${name}笔试真题`),
          ],
          SEO_OVERSEAS_JOB_KEYWORDS,
        )}
      />
    </>
  );
}
