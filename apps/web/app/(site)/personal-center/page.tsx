import dynamic from 'next/dynamic';
import type { Metadata } from 'next';
import { SitePageSkeleton } from '@/components/layout/site-page-skeleton';
import { buildPageMetadata } from '@/lib/seo';

const PersonalCenterClient = dynamic(
  () => import('@/components/personal/personal-center-client').then((mod) => mod.PersonalCenterClient),
  {
    ssr: false,
    loading: () => <SitePageSkeleton />,
  },
);

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
