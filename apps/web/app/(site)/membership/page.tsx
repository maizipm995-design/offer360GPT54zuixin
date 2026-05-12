import type { Metadata } from 'next';
import { MembershipOpenPageClient } from '@/components/membership/membership-open-page-client';
import { serverGet } from '@/lib/api';
import { buildPageMetadata } from '@/lib/seo';
import { MembershipBenefitsContent, MembershipPlanItem } from '@/types';

export const metadata: Metadata = buildPageMetadata({
  title: '求职会员开通_会员权益_大学生校招求职服务',
  description: 'offer360 求职会员提供校招公告查看、岗位搜索、专属推荐、求职资料包与求职支持等多项权益。',
  path: '/membership',
  keywords: ['求职会员', 'offer360会员', '校招会员', '大学生求职服务', '校招公告查看', '岗位搜索'],
});

export default async function MembershipPage() {
  const [benefitsContent, plans] = await Promise.all([
    serverGet<MembershipBenefitsContent>('/membership-page/benefits'),
    serverGet<MembershipPlanItem[]>('/membership-page/plans'),
  ]);

  return <MembershipOpenPageClient benefitsContent={benefitsContent} plans={plans} />;
}
