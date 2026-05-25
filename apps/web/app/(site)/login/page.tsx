import dynamic from 'next/dynamic';
import type { Metadata } from 'next';
import { SitePageSkeleton } from '@/components/layout/site-page-skeleton';
import { buildPageMetadata } from '@/lib/seo';

const UnifiedAuthPageClient = dynamic(
  () => import('@/components/auth/unified-auth-page-client').then((mod) => mod.UnifiedAuthPageClient),
  {
    ssr: false,
    loading: () => <SitePageSkeleton compact />,
  },
);

export const metadata: Metadata = buildPageMetadata({
  title: '登录',
  description: 'offer360 用户登录页。',
  path: '/login',
  robots: {
    index: false,
    follow: true,
  },
});

export default function LoginPage() {
  return <UnifiedAuthPageClient />;
}
