'use client';

import { useCallback, useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { BriefcaseBusiness, FileText, GraduationCap, Map, PenSquare, Sparkles, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface SiteNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const SITE_MAIN_NAV_ITEMS: SiteNavItem[] = [
  { href: '/', label: '名企校招', icon: GraduationCap },
  { href: '/campus-exam', label: '笔试真题', icon: PenSquare },
  { href: '/resume-optimizer', label: 'AI简历优化', icon: Sparkles },
  { href: '/interview-transcript', label: '面试辅导', icon: FileText },
  { href: '/services', label: '求职服务', icon: BriefcaseBusiness },
  { href: '/career-journey', label: '校招攻略', icon: Map },
  { href: '/personal-center', label: '个人中心', icon: UserRound },
];

export const SITE_MOBILE_NAV_ITEMS: SiteNavItem[] = [
  SITE_MAIN_NAV_ITEMS[0],
  SITE_MAIN_NAV_ITEMS[1],
  SITE_MAIN_NAV_ITEMS[3],
  SITE_MAIN_NAV_ITEMS[4],
  SITE_MAIN_NAV_ITEMS[6],
];

const desktopNavShellClass =
  'mx-auto flex w-full min-w-0 items-center justify-center overflow-x-auto rounded-full bg-white/80 p-1.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden';
const desktopNavGroupClass = 'inline-flex min-w-max items-center gap-2';
const desktopNavPillBaseClass =
  'inline-flex items-center justify-center rounded-full px-4 py-2 text-[16px] font-semibold leading-none tracking-[0.01em] transition-all duration-200';
const desktopNavLinkClass = 'inline-flex h-10 items-center justify-center';
const desktopNavPillIdleClass = 'text-slate-600 hover:bg-brand/10 hover:text-brand';
const desktopNavPillActiveClass = 'bg-brand text-white shadow-[0_8px_18px_rgba(255,128,2,0.16)] hover:bg-brand-dark';
const desktopNavPillPendingClass = 'bg-brand/12 text-brand shadow-[0_8px_18px_rgba(255,128,2,0.08)]';
const mobileNavItemBaseClass =
  'flex min-h-[56px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium tracking-[0.01em] transition-all duration-200';
const mobileNavItemIdleClass = 'text-slate-500 hover:bg-brand/10 hover:text-brand';
const mobileNavItemActiveClass = 'bg-brand text-white shadow-[0_8px_18px_rgba(255,128,2,0.18)]';
const mobileNavItemPendingClass = 'bg-brand/10 text-brand';

function useNavPrefetch(pathname: string) {
  const router = useRouter();

  return useCallback((href: string) => {
    if (href !== pathname && href !== '/campus-exam') {
      router.prefetch(href);
    }
  }, [pathname, router]);
}

export function getSiteMobileTitle(pathname: string) {
  if (pathname.startsWith('/membership')) return '开通会员';
  if (pathname.startsWith('/login')) return '登录';

  const matchedItem = SITE_MAIN_NAV_ITEMS.find((item) => isSiteNavActive(pathname, item.href));
  return matchedItem?.label ?? '名企校招';
}

export function isSiteNavActive(pathname: string, href: string) {
  if (href === '/') {
    return pathname === '/';
  }
  return pathname.startsWith(href);
}

export function SiteDesktopNavigation({ pathname }: { pathname: string }) {
  const prefetchHref = useNavPrefetch(pathname);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  return (
    <nav className={desktopNavShellClass} aria-label="站点主导航">
      <div className={desktopNavGroupClass}>
        {SITE_MAIN_NAV_ITEMS.map((item) => {
          const active = isSiteNavActive(pathname, item.href);
          const pending = !active && pendingHref === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={item.href === '/campus-exam' ? false : undefined}
              aria-current={active ? 'page' : undefined}
              aria-busy={pending || undefined}
              title={item.label}
              className={desktopNavLinkClass}
              onClick={() => setPendingHref(item.href)}
              onMouseEnter={() => prefetchHref(item.href)}
              onTouchStart={() => prefetchHref(item.href)}
            >
              <span
                className={cn(
                  desktopNavPillBaseClass,
                  active ? desktopNavPillActiveClass : pending ? desktopNavPillPendingClass : desktopNavPillIdleClass,
                )}
              >
                <span className="truncate whitespace-nowrap text-center">{item.label}</span>
                {pending ? <span className="ml-2 inline-block h-2 w-2 animate-pulse rounded-full bg-current" aria-hidden="true" /> : null}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function SiteMobileNavigation({ pathname }: { pathname: string }) {
  const prefetchHref = useNavPrefetch(pathname);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  return (
    <div className="grid grid-cols-5 gap-1 px-2 py-2">
      {SITE_MOBILE_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = isSiteNavActive(pathname, item.href);
        const pending = !active && pendingHref === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={item.href === '/campus-exam' ? false : undefined}
            aria-current={active ? 'page' : undefined}
            aria-busy={pending || undefined}
            className={cn(
              mobileNavItemBaseClass,
              active ? mobileNavItemActiveClass : pending ? mobileNavItemPendingClass : mobileNavItemIdleClass,
            )}
            onClick={() => setPendingHref(item.href)}
            onMouseEnter={() => prefetchHref(item.href)}
            onTouchStart={() => prefetchHref(item.href)}
          >
            <Icon className="h-4.5 w-4.5 shrink-0" />
            <span className="truncate text-center">{pending ? '加载中' : item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
