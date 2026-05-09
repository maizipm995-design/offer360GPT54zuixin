import type { Metadata, Viewport } from 'next';
import { GlobalToastViewport } from '@/components/ui/global-toast-viewport';
import './globals.css';

export const metadata: Metadata = {
  title: 'offer360 - 校招信息聚合与求职服务平台',
  description: '基于 Next.js 14 + NestJS + Prisma 构建的校招聚合与求职服务平台',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-slate-50 text-ink">
        {children}
        <GlobalToastViewport />
      </body>
    </html>
  );
}
