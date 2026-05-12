import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: '邀请注册',
  description: 'offer360 邀请注册落地页。',
  path: '/invite',
  robots: {
    index: false,
    follow: false,
  },
});

export default async function InviteLandingPage({ params }: { params: { randomKey: string } }) {
  const inviteToken = params.randomKey?.trim();
  redirect(inviteToken ? `/register?inviteToken=${encodeURIComponent(inviteToken)}` : '/register');
}
