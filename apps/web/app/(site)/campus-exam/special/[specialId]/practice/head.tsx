import { getAbsoluteUrl } from '@/lib/seo';

export default function CampusExamSpecialPracticeHead({
  params,
}: {
  params: { specialId: string };
}) {
  const title = '笔试真题专项练习_顺序刷题与做题进度 - Offer360';
  const description = 'Offer360 笔试真题专项练习页，支持专项顺序刷题、做题进度同步与结果复盘。';
  const path = `/campus-exam/special/${encodeURIComponent(params.specialId)}/practice`;

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content="笔试真题专项练习,顺序刷题,做题进度,笔试复盘,Offer360" />
      <meta name="robots" content="noindex,follow" />
      <link rel="canonical" href={getAbsoluteUrl(path)} />
    </>
  );
}
