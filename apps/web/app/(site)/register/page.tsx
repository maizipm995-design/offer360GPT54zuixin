import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: '注册',
  description: 'offer360 用户注册页。',
  path: '/register',
  robots: {
    index: false,
    follow: true,
  },
});

export default function RegisterPage({
  searchParams,
}: {
  searchParams?: { inviteCode?: string; inviteToken?: string; redirect?: string };
}) {
  const nextSearchParams = new URLSearchParams();
  if (searchParams?.inviteToken) {
    nextSearchParams.set('inviteToken', searchParams.inviteToken);
  }
  if (searchParams?.inviteCode) {
    nextSearchParams.set('inviteCode', searchParams.inviteCode);
  }
  if (searchParams?.redirect) {
    nextSearchParams.set('redirect', searchParams.redirect);
  }

  const queryString = nextSearchParams.toString();
  redirect(queryString ? `/login?${queryString}` : '/login');
}
