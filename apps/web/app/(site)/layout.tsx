'use client';

import { usePathname } from 'next/navigation';
import { SiteHeader } from '@/components/layout/site-header';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideSiteChrome = pathname.startsWith('/resume-optimizer');

  if (hideSiteChrome) {
    return children;
  }

  return (
    <div className="pb-[104px] pt-[48px] lg:pb-0 lg:pt-[64px]">
      <SiteHeader />
      {children}
    </div>
  );
}
