import { getCampusExamCategoryDetail } from '@/lib/campus-exam-page-data';
import { getAbsoluteUrl, mergeSeoKeywords, SEO_OVERSEAS_JOB_KEYWORDS } from '@/lib/seo';

export default async function CampusExamCategoryHead({
  params,
}: {
  params: Promise<{ categorySlug: string }>;
}) {
  const { categorySlug } = await params;
  const path = `/campus-exam/category/${encodeURIComponent(categorySlug)}`;
  let title = '笔试真题分类练习_名企校招笔试题库 - Offer360';
  let description = 'Offer360 笔试真题分类页聚合该方向下的名企笔试真题与专项练习，提供分类刷题与专项练习入口。';
  let keywords = '笔试真题分类,笔试题库,校招真题,大厂笔试,专项练习,分类刷题,Offer360';

  try {
    const data = await getCampusExamCategoryDetail(categorySlug);
    const specialNames = data.specials.slice(0, 4).map((special) => special.name).join('、');
    title = `${data.name}笔试真题分类_校招笔试真题与专项练习入口 - Offer360`;
    description = data.description?.trim()
      ? `${data.description.trim()}。Offer360 ${data.name} 分类页聚合 ${data.specials.length} 个专项练习入口${specialNames ? `，重点覆盖 ${specialNames}` : ''}，适合大学生、留学生与海归围绕实习校招场景系统刷题。`
      : `Offer360 ${data.name} 分类页聚合 ${data.specials.length} 个专项练习入口${specialNames ? `，重点覆盖 ${specialNames}` : ''}，覆盖校招笔试真题、专项刷题、标准答案与题目解析。`;
    keywords = mergeSeoKeywords(
      [
        `${data.name}笔试真题`,
        `${data.name}题库`,
        `${data.name}专项练习`,
        data.name,
        `${data.name}分类刷题`,
        '校招笔试真题',
        '实习校招',
        '求职全流程',
        '大学生',
        '留学生',
        '海归',
      ],
      SEO_OVERSEAS_JOB_KEYWORDS,
    ).join(',');
  } catch {
    // 详情获取失败时回退到通用 metadata，避免阻塞页面渲染。
  }

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <link rel="canonical" href={getAbsoluteUrl(path)} />
    </>
  );
}
