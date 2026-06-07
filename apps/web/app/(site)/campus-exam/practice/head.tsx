import { getAbsoluteUrl } from '@/lib/seo';

export default function CampusExamPracticeHead() {
  const title = '笔试真题练习_快速练习与自定义刷题 - Offer360';
  const description = 'Offer360 笔试真题练习页，支持快速练习、自定义刷题与模考训练。';

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content="笔试真题练习,快速练习,自定义刷题,笔试模考,Offer360" />
      <meta name="robots" content="noindex,follow" />
      <link rel="canonical" href={getAbsoluteUrl('/campus-exam/practice')} />
    </>
  );
}
