import { MembershipOpenPageClient } from '@/components/membership/membership-open-page-client';
import { serverGet } from '@/lib/api';
import { MembershipBenefitsContent, MembershipPlanItem } from '@/types';

export default async function MembershipPage() {
  const [benefitsContent, plans] = await Promise.all([
    serverGet<MembershipBenefitsContent>('/membership-page/benefits'),
    serverGet<MembershipPlanItem[]>('/membership-page/plans'),
  ]);

  return <MembershipOpenPageClient benefitsContent={benefitsContent} plans={plans} />;
}
