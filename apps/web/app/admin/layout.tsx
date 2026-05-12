import type { Metadata } from 'next';
import { AdminShell } from '@/components/admin/admin-shell';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: '后台管理',
  description: 'offer360 后台管理页面。',
  path: '/admin',
  robots: {
    index: false,
    follow: false,
  },
});

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
