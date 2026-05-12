import type { Metadata } from 'next';
import { UnifiedAuthPageClient } from '@/components/auth/unified-auth-page-client';
import { buildPageMetadata } from '@/lib/seo';

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
