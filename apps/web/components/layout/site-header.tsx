'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BriefcaseBusiness, ChevronDown, Crown, GraduationCap, LogOut, Map, Sparkles, UserRound } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { clientFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { AuthUser, PersonalOverview } from '@/types';

const BRAND_LOGO_URL = 'https://i.postimg.cc/h4scGvF6/sun-lao-shilogo-64X64.png';

const navs = [
  { href: '/', label: '名企校招', icon: GraduationCap },
  { href: '/resume-optimizer', label: '简历优化', icon: Sparkles },
  { href: '/services', label: '求职服务', icon: BriefcaseBusiness },
  { href: '/career-journey', label: '我的求职之路', icon: Map },
  { href: '/personal-center', label: '个人中心', icon: UserRound },
];

const desktopPillClass =
  'inline-flex h-9 min-w-[100px] items-center justify-center rounded-full px-4 text-sm font-semibold leading-none transition-all duration-200';
const desktopNavIdleClass = 'text-slate-600 hover:bg-brand/10 hover:text-brand hover:shadow-[0_6px_16px_rgba(255,128,2,0.12)]';
const desktopNavActiveClass = 'bg-brand text-white shadow-[0_8px_18px_rgba(255,128,2,0.18)] hover:bg-brand-dark';
const desktopPrimaryActionClass = 'h-9 min-w-[120px] rounded-full px-4 text-sm font-semibold shadow-[0_8px_18px_rgba(255,128,2,0.18)]';
const mobileTopActionClass =
  'inline-flex h-8 min-w-[80px] items-center justify-center rounded-full px-3 text-[11px] font-semibold leading-none transition-all duration-200';

function getMobileTitle(pathname: string) {
  if (pathname.startsWith('/membership')) return '开通会员';
  if (pathname.startsWith('/resume-optimizer')) return '简历优化';
  if (pathname.startsWith('/services')) return '求职服务';
  if (pathname.startsWith('/career-journey')) return '我的求职之路';
  if (pathname.startsWith('/personal-center')) return '个人中心';
  if (pathname.startsWith('/login')) return '登录';
  return '名企校招';
}

function getUserDisplayName(name?: string | null, phone?: string | null) {
  return (name || phone || '个人中心').trim();
}

function isNavActive(pathname: string, href: string) {
  if (href === '/') {
    return pathname === '/';
  }
  return pathname.startsWith(href);
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { token, user, updateUser, logout } = useAuthStore();
  const mobileTitle = getMobileTitle(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const desktopMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!token) return;

    const syncFromOverview = async () => {
      const overview = await clientFetch<PersonalOverview>('/me/overview', {}, token);
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

    syncFromOverview().catch(() => syncFromAuthMe().catch(() => undefined));
  }, [token, updateUser, user?.name]);

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
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto hidden h-[56px] max-w-[1366px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-4 md:grid lg:px-6">
          <div className="min-w-0">
            <Link prefetch={false} href="/" className="inline-flex items-center gap-2 whitespace-nowrap">
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

          <nav className="flex items-center justify-center gap-1.5">
            {navs.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className={cn(
                  desktopPillClass,
                  isNavActive(pathname, item.href) ? desktopNavActiveClass : desktopNavIdleClass,
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex min-w-0 items-center justify-self-end gap-2">
            <Button
              className={cn(desktopPrimaryActionClass, 'hover:bg-brand-dark')}
              onClick={handleMembershipClick}
            >
              <Crown className="mr-1.5 h-4 w-4" />
              {vipLabel}
            </Button>
            {user ? (
              <div className="relative" ref={desktopMenuRef}>
                <button
                  type="button"
                  className="inline-flex h-9 min-w-[100px] max-w-[180px] items-center justify-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-semibold leading-none text-slate-700 transition-all duration-200 hover:border-brand hover:bg-brand/10 hover:text-brand hover:shadow-[0_6px_16px_rgba(255,128,2,0.12)]"
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
              <Button className={cn(desktopPrimaryActionClass, 'hover:bg-brand-dark')} onClick={() => router.push('/login')}>
                登录/注册
              </Button>
            )}
          </div>
        </div>

        <div className="mx-auto flex h-[48px] max-w-[1366px] items-center justify-between gap-2 px-3 md:hidden">
          <Link prefetch={false} href="/" className="inline-flex min-w-0 max-w-[140px] items-center gap-1.5">
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

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
        <div className="grid grid-cols-5 gap-1 px-2 py-2">
          {navs.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 rounded-xl px-2.5 py-2 text-[10px] font-bold transition-all duration-200',
                  active
                    ? 'bg-brand text-white shadow-[0_8px_18px_rgba(255,128,2,0.18)]'
                    : 'text-slate-500 hover:bg-brand/10 hover:text-brand',
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
