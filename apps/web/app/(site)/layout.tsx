import { SiteHeader } from '@/components/layout/site-header';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-20 md:pb-0">
      <SiteHeader />
      {children}
    </div>
  );
}
