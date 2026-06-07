import nextDynamic from 'next/dynamic';
import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { SeoHiddenContent } from '@/components/common/seo-hidden-content';
import { SeoLinkCluster } from '@/components/common/seo-link-cluster';
import { SitePageSkeleton } from '@/components/layout/site-page-skeleton';
import { serverGet } from '@/lib/api';
import { buildBreadcrumbSchema, buildPageMetadata, buildWebPageSchema, mergeSeoKeywords, SEO_OVERSEAS_JOB_KEYWORDS } from '@/lib/seo';
import { MembershipBenefitsContent, MembershipPlanItem } from '@/types';

const MembershipOpenPageClient = nextDynamic(
  () => import('@/components/membership/membership-open-page-client').then((mod) => mod.MembershipOpenPageClient),
  {
    loading: () => <SitePageSkeleton />,
  },
);

export const dynamic = 'force-dynamic';
export const revalidate = 1800;

const getMembershipPageData = unstable_cache(
  async () => Promise.all([
    serverGet<MembershipBenefitsContent>('/membership-page/benefits'),
    serverGet<MembershipPlanItem[]>('/membership-page/plans'),
  ]),
  ['site-membership-page'],
  { revalidate },
);

export const metadata: Metadata = buildPageMetadata({
  title: '求职会员开通_校招信息查看_岗位搜索_面试辅导权益',
  description: 'Offer360 求职会员提供实习校招、招聘公告、春招、秋招、夏招信息查看、岗位搜索、AI简历优化、面试辅导与求职全流程支持等多项权益，也覆盖留学生与海归求职用户的核心需求。',
  path: '/membership',
  keywords: mergeSeoKeywords([
    '求职会员',
    'offer360会员',
    '校招会员',
    '实习校招',
    '招聘公告',
    '春招',
    '秋招',
    '夏招',
    '大学生求职服务',
    '校招公告查看',
    'AI简历优化',
    '岗位搜索',
    '面试辅导',
    '校招笔试真题',
    '求职资料包',
  ], SEO_OVERSEAS_JOB_KEYWORDS, [
    '留学生求职会员',
    '海归求职会员',
  ]),
});

export default async function MembershipPage() {
  const [benefitsContent, plans] = await getMembershipPageData();
  const membershipPageSchema = buildWebPageSchema({
    title: 'Offer360 求职会员页',
    description: '面向大学生与应届生的求职会员权益页，覆盖校招公告查看、岗位搜索、专属推荐、求职资料包、面试辅导与求职支持。',
    path: '/membership',
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(membershipPageSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildBreadcrumbSchema([
              { name: '首页', path: '/' },
              { name: '求职会员', path: '/membership' },
            ]),
          ),
        }}
      />
      <MembershipOpenPageClient benefitsContent={benefitsContent} plans={plans} />
      <>
        <SeoHiddenContent
          title="求职会员页 SEO 隐藏内容"
          paragraphs={[
            'Offer360 求职会员覆盖实习校招、招聘公告、春招、秋招、夏招、岗位搜索、AI 简历优化、面试辅导与求职全流程支持。',
            '会员页同时承接大学生、留学生与海归求职场景，可作为校招信息浏览、笔试练习、简历优化和服务购买的统一入口。',
          ]}
        />
        <SeoLinkCluster
          title="延伸浏览入口"
          description="会员权益与名企校招、笔试真题、AI简历优化、面试辅导、求职服务页面互相关联，便于用户按求职阶段继续浏览。"
        />
      </>
    </>
  );
}
