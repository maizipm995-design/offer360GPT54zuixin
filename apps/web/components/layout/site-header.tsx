'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown, Crown, LogOut } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { SiteDesktopNavigation, SiteMobileNavigation, getSiteMobileTitle } from '@/components/layout/site-navigation';
import { Button } from '@/components/ui/button';
import { clientFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { AuthUser, PersonalOverview } from '@/types';

const BRAND_LOGO_URL = 'https://i.postimg.cc/h4scGvF6/sun-lao-shilogo-64X64.png';

const desktopPrimaryActionClass =
  'h-9 rounded-full px-3 text-[13px] font-semibold shadow-[0_8px_18px_rgba(255,128,2,0.16)]';
const mobileTopActionClass =
  'inline-flex h-8 min-w-[80px] items-center justify-center rounded-full px-3 text-[11px] font-semibold leading-none transition-all duration-200';

function getUserDisplayName(name?: string | null, phone?: string | null) {
  return (name || phone || '个人中心').trim();
}

function isUnauthorizedError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return message.includes('unauthorized') || message.includes('401');
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { token, user, updateUser, logout } = useAuthStore();
  const mobileTitle = getSiteMobileTitle(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const desktopMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const lastSyncedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!token) return;
    if (lastSyncedTokenRef.current === token) return;

    lastSyncedTokenRef.current = token;
    let cancelled = false;
    let timer: number | null = null;

    const syncFromOverview = async () => {
      const overview = await clientFetch<PersonalOverview>('/me/overview', {}, token);
      if (cancelled) {
        return;
      }
      updateUser({
        phone: overview.phone,
        name: overview.profile?.name || user?.name || '',
        isMember: overview.isMember,
        memberLevel: overview.memberLevel,
        memberLevelLabel: overview.memberLevelLabel,
        memberRoleCode: overview.memberRoleCode,
        memberRoleName: overview.memberRoleName,
        permissionKeys: overview.permissionKeys,
        membershipRemainingDays: overview.membershipRemainingDays,
      });
    };

    const syncFromAuthMe = async () => {
      const authUser = await clientFetch<AuthUser & { profile?: { name?: string | null } | null }>('/auth/me', {}, token);
      if (cancelled) {
        return;
      }
      updateUser({
        phone: authUser.phone,
        name: authUser.profile?.name || user?.name || '',
        isMember: authUser.isMember,
        memberLevel: authUser.memberLevel,
        memberLevelLabel: authUser.memberLevelLabel,
        memberRoleCode: authUser.memberRoleCode,
        memberRoleName: authUser.memberRoleName,
        permissionKeys: authUser.permissionKeys,
        membershipRemainingDays: authUser.membershipRemainingDays,
      });
    };

    const syncUserState = () => {
      void syncFromOverview().catch((overviewError) => {
        void syncFromAuthMe().catch((authError) => {
          if (cancelled) {
            return;
          }
          if (isUnauthorizedError(overviewError) || isUnauthorizedError(authError)) {
            logout();
            router.refresh();
          }
        });
      });
    };

    const hasPersistedUserState = Boolean(user?.phone && user?.memberRoleCode && Array.isArray(user?.permissionKeys));
    if (hasPersistedUserState) {
      timer = window.setTimeout(syncUserState, 1200);
    } else {
      syncUserState();
    }

    return () => {
      cancelled = true;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [token, logout, router, updateUser, user?.memberRoleCode, user?.name, user?.permissionKeys, user?.phone]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const inDesktopMenu = desktopMenuRef.current?.contains(target);
      const inMobileMenu = mobileMenuRef.current?.contains(target);
      if (!inDesktopMenu && !inMobileMenu) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const userDisplayName = useMemo(() => getUserDisplayName(user?.name, user?.phone), [user?.name, user?.phone]);
  const vipRemainingDays = user?.isMember ? Math.max(user.membershipRemainingDays ?? 1, 1) : 0;
  const vipLabel = user?.isMember ? `会员剩余${vipRemainingDays}天` : '立即开通会员';
  const isResumePrintRoute = pathname.startsWith('/resume-optimizer/print/');

  if (isResumePrintRoute) {
    return null;
  }

  const handleMembershipClick = () => {
    if (!user || !user.isMember) {
      router.push('/membership');
      return;
    }
    router.push('/personal-center#membership');
  };

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    router.push('/');
  };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-[120] border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto hidden h-[64px] w-[92%] max-w-[1366px] min-w-0 items-center gap-3 px-2 lg:flex xl:px-4">
          <div className="w-[148px] shrink-0 xl:w-[168px]">
            <Link href="/" className="inline-flex items-center gap-2 whitespace-nowrap">
              <span className="flex h-[45px] w-[45px] items-center justify-center overflow-hidden rounded-xl bg-white p-0">
                <Image
                  src={BRAND_LOGO_URL}
                  alt="Offer360 Logo"
                  width={45}
                  height={45}
                  className="h-full w-full object-contain"
                  priority
                  unoptimized
                />
              </span>
              <span className="inline-flex items-baseline whitespace-nowrap text-[1.65rem] font-black leading-none tracking-[-0.02em] text-ink">
                <span>Offer</span>
                <span className="ml-0 text-brand">360</span>
              </span>
            </Link>
          </div>

          <div className="min-w-0 flex-1">
            <SiteDesktopNavigation pathname={pathname} />
          </div>

          <div className="ml-auto flex w-[250px] shrink-0 items-center justify-end gap-1.5 xl:w-[276px]">
            <Button
              className={cn(desktopPrimaryActionClass, 'w-[124px] px-2.5 hover:bg-brand-dark xl:w-[136px]')}
              onClick={handleMembershipClick}
            >
              <Crown className="mr-1.5 h-4 w-4" />
              <span className="truncate">{vipLabel}</span>
            </Button>
            {user ? (
              <div className="relative" ref={desktopMenuRef}>
                <button
                  type="button"
                  className="inline-flex h-9 w-[112px] items-center justify-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-semibold leading-none text-slate-700 transition-all duration-200 hover:border-brand hover:bg-brand/10 hover:text-brand hover:shadow-[0_6px_16px_rgba(255,128,2,0.12)] xl:w-[132px]"
                  onClick={() => setMenuOpen((prev) => !prev)}
                >
                  <span className="truncate">{userDisplayName}</span>
                  <ChevronDown className={cn('h-4 w-4 shrink-0 transition', menuOpen ? 'rotate-180' : '')} />
                </button>
                {menuOpen ? (
                  <div className="absolute right-0 top-full z-50 mt-2 w-40 overflow-hidden rounded-2xl border border-slate-200 bg-white py-2 shadow-[0_16px_40px_rgba(15,23,42,0.12)]">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-50 hover:text-brand"
                      onClick={handleLogout}
                    >
                      <LogOut className="h-4 w-4" />
                      退出登录
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <Button className={cn(desktopPrimaryActionClass, 'w-[112px] hover:bg-brand-dark xl:w-[132px]')} onClick={() => router.push('/login')}>
                登录/注册
              </Button>
            )}
          </div>
        </div>

        <div className="mx-auto flex h-[48px] max-w-[1366px] items-center justify-between gap-2 px-3 lg:hidden">
          <Link href="/" className="inline-flex min-w-0 max-w-[140px] items-center gap-1.5">
            <span className="flex h-[40px] w-[40px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-0">
              <Image
                src={BRAND_LOGO_URL}
                alt="Offer360 Logo"
                width={40}
                height={40}
                className="h-full w-full object-contain"
                priority
              />
            </span>
            <span className="inline-flex items-baseline truncate text-[1.15rem] font-black leading-none tracking-[-0.02em] text-ink">
              <span>Offer</span>
              <span className="ml-0 text-brand">360</span>
            </span>
          </Link>
          <p className="flex-1 truncate text-center text-[12px] font-bold text-ink">{mobileTitle}</p>
          {user ? (
            <div className="relative" ref={mobileMenuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                className={cn(
                  mobileTopActionClass,
                  'max-w-[120px] border border-slate-200 text-slate-700 hover:border-brand hover:bg-brand/10 hover:text-brand',
                )}
                aria-label="打开用户菜单"
              >
                <span className="truncate">{userDisplayName}</span>
                <ChevronDown className={cn('ml-1 h-3.5 w-3.5 shrink-0 transition', menuOpen ? 'rotate-180' : '')} />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-full z-50 mt-2 w-36 overflow-hidden rounded-2xl border border-slate-200 bg-white py-2 shadow-[0_16px_40px_rgba(15,23,42,0.12)]">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-50 hover:text-brand"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    退出登录
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => router.push('/login')}
              className={cn(mobileTopActionClass, 'bg-brand text-white shadow-[0_6px_16px_rgba(255,128,2,0.16)] hover:bg-brand-dark')}
              aria-label="进入登录页"
            >
              登录/注册
            </button>
          )}
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-[110] border-t border-slate-200 bg-white/95 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
        <SiteMobileNavigation pathname={pathname} />
      </nav>
    </>
  );
}
