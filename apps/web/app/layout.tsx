import type { Metadata, Viewport } from 'next';
import { GlobalToastViewport } from '@/components/ui/global-toast-viewport';
import { buildOrganizationSchema, buildRootMetadata, buildSiteNavigationSchema, buildWebsiteSchema } from '@/lib/seo';
import './globals.css';

export const metadata: Metadata = buildRootMetadata();

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#ff8002',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const organizationSchema = buildOrganizationSchema();
  const websiteSchema = buildWebsiteSchema();
  const siteNavigationSchema = buildSiteNavigationSchema();

  return (
    <html lang="zh-CN">
      <body className="bg-slate-50 text-ink">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteSchema),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(siteNavigationSchema),
          }}
        />
        {children}
        <GlobalToastViewport />
      </body>
    </html>
  );
}
