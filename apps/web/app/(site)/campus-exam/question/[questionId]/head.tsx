import { getCampusExamQuestionDetail } from '@/lib/campus-exam-page-data';
import { getAbsoluteUrl, mergeSeoKeywords, SEO_OVERSEAS_JOB_KEYWORDS } from '@/lib/seo';

export default async function CampusExamQuestionHead({
  params,
}: {
  params: Promise<{ questionId: string }>;
}) {
  const { questionId } = await params;
  const path = `/campus-exam/question/${encodeURIComponent(questionId)}`;
  let title = '笔试真题解析_大厂笔试真题标准答案与详解 - Offer360';
  let description = 'Offer360 笔试真题详情页提供名企校招笔试题目的完整题干、标准答案及深度解析。';
  let keywords = '笔试真题解析,标准答案,题干详情,名企笔试真题,校招刷题,笔试复盘,Offer360';

  try {
    const data = await getCampusExamQuestionDetail(questionId);
    const categoryName = data.special?.category?.name;
    const specialName = data.special?.name;
    const highFrequencyText = data.isHighFrequencyWrong ? '高频错题' : '标准题目';
    title = `${categoryName ? `${categoryName}_` : ''}${specialName ?? '校招笔试'}_${data.questionTypeLabel}标准答案与解析_${highFrequencyText} - Offer360`;
    description = `Offer360 提供${categoryName ? `${categoryName}分类下` : ''}${specialName ? `${specialName}专项` : '校招笔试'}的${data.questionTypeLabel}真题解析，包含标准答案、答案解析、难度 ${data.difficulty}${data.isHighFrequencyWrong ? ' 与高频错题标签' : ''}，适合大学生、留学生与海归备战实习校招。`;
    keywords = mergeSeoKeywords(
      [
        specialName,
        categoryName,
        data.questionTypeLabel,
        `${specialName ?? '校招笔试'}${data.questionTypeLabel}`,
        `${data.questionTypeLabel}标准答案`,
        `${data.questionTypeLabel}解析`,
        '校招笔试真题',
        '实习校招',
        '求职全流程',
        '大学生',
        '留学生',
        '海归',
        data.isHighFrequencyWrong ? '高频错题' : undefined,
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
