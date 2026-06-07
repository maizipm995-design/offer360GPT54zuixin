import { getAbsoluteUrl } from '@/lib/seo';

export default function CampusExamHead() {
  const title = '笔试真题_名企校招笔试题库练习_大厂真题专项刷题_Offer360';
  const description =
    'Offer360 笔试真题题库涵盖互联网、金融、咨询等名企校招历年笔试真题，提供分类题库练习、专项知识点刷题及全真模拟考试，助力应届生高效通关校招笔试。';
  const canonical = getAbsoluteUrl('/campus-exam');

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta
        name="keywords"
        content="笔试真题,名企笔试,校招题库,大厂真题,专项练习,笔试模考,应届生笔试,Offer360"
      />
      <link rel="canonical" href={canonical} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
    </>
  );
}
