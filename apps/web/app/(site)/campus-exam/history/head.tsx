import { getAbsoluteUrl } from '@/lib/seo';

export default function CampusExamHistoryHead() {
  const title = '笔试真题练习历史_刷题记录与进度查看 - Offer360';
  const description = 'Offer360 笔试真题练习历史页，支持查看近期刷题记录、得分率、做题进度与继续练习入口。';

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content="笔试真题,练习历史,刷题记录,笔试进度,Offer360" />
      <meta name="robots" content="noindex,follow" />
      <link rel="canonical" href={getAbsoluteUrl('/campus-exam/history')} />
    </>
  );
}
