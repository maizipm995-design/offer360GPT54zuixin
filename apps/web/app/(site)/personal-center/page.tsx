import type { Metadata } from 'next';
import { PersonalCenterClient } from '@/components/personal/personal-center-client';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: '个人中心',
  description: 'offer360 个人中心。',
  path: '/personal-center',
  robots: {
    index: false,
    follow: false,
  },
});

export default function PersonalCenterPage() {
  return <PersonalCenterClient />;
}
