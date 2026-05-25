import nextDynamic from 'next/dynamic';
import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { SitePageSkeleton } from '@/components/layout/site-page-skeleton';
import { serverGet } from '@/lib/api';
import { buildPageMetadata, buildWebPageSchema } from '@/lib/seo';
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
  title: '求职会员开通_校招信息查看_岗位搜索_面试逐字稿权益',
  description: 'Offer360 求职会员提供校招公告查看、岗位搜索、专属推荐、求职资料包、面试逐字稿与全流程求职支持等多项权益。',
  path: '/membership',
  keywords: ['求职会员', 'offer360会员', '校招会员', '大学生求职服务', '校招公告查看', '岗位搜索', '面试逐字稿', '求职资料包'],
});

export default async function MembershipPage() {
  const [benefitsContent, plans] = await getMembershipPageData();
  const membershipPageSchema = buildWebPageSchema({
    title: 'Offer360 求职会员页',
    description: '面向大学生与应届生的求职会员权益页，覆盖校招公告查看、岗位搜索、专属推荐、求职资料包、面试逐字稿与求职支持。',
    path: '/membership',
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(membershipPageSchema) }}
      />
      <MembershipOpenPageClient benefitsContent={benefitsContent} plans={plans} />
    </>
  );
}
