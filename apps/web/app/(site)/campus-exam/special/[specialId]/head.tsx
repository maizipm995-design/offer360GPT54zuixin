import { getCampusExamSpecialDetail } from '@/lib/campus-exam-page-data';
import { getAbsoluteUrl, mergeSeoKeywords, SEO_OVERSEAS_JOB_KEYWORDS } from '@/lib/seo';

export default async function CampusExamSpecialHead({
  params,
}: {
  params: Promise<{ specialId: string }>;
}) {
  const { specialId } = await params;
  const path = `/campus-exam/special/${encodeURIComponent(specialId)}`;
  let title = '笔试真题专项练习_名企校招真题解析与刷题 - Offer360';
  let description = 'Offer360 笔试真题专项页提供名企校招笔试真题的深度练习，包含题型分布、难度分析及顺序练习入口。';
  let keywords = '笔试专项练习,校招真题解析,大厂笔试题库,专项刷题,笔试难度分析,笔试真题,Offer360';

  try {
    const data = await getCampusExamSpecialDetail(specialId);
    const questionTypeSummary = data.questionTypeDistribution
      .filter((item) => item.count > 0)
      .slice(0, 3)
      .map((item) => item.label)
      .join('、');
    title = `${data.name}专项练习_${data.category.name}校招笔试真题解析 - Offer360`;
    description = data.description?.trim()
      ? `${data.description.trim()}。Offer360 为 ${data.category.name} 方向提供 ${data.questionCount} 道 ${data.name} 专项练习题${questionTypeSummary ? `，覆盖 ${questionTypeSummary}` : ''}，适合大学生、留学生与海归备战实习校招。`
      : `Offer360 ${data.name} 专项提供 ${data.questionCount} 道练习题${questionTypeSummary ? `，覆盖 ${questionTypeSummary}` : ''}，聚合校招笔试真题、标准答案解析与专项刷题入口。`;
    keywords = mergeSeoKeywords(
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
