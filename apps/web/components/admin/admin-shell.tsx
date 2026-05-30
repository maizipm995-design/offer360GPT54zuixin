'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Coins,
  Crown,
  FileText,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Newspaper,
  Receipt,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Ticket,
  Users,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { clearAdminToken } from '@/lib/admin-auth';
import { clientFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AdminAuthSession, AdminBootstrapStatus } from '@/types';

const adminMenus = [
  { href: '/admin/overview', label: '数据总览', icon: LayoutDashboard, permission: 'dashboard:view' },
  { href: '/admin/admin-users', label: '后台账号管理', icon: ShieldCheck, permission: 'admin:admin-user:manage' },
  { href: '/admin/admin-roles', label: '角色权限管理', icon: Settings2, permission: 'admin:role:manage' },
  { href: '/admin/operation-logs', label: '操作日志', icon: FileText, permission: 'admin:operation-log:view' },
  { href: '/admin/jobs-risk-controls', label: '招聘风控处置', icon: ShieldCheck, permission: 'admin:operation-log:view' },
  { href: '/admin/jobs', label: '招聘公告管理', icon: Newspaper, permission: 'admin:job:manage' },
  { href: '/admin/campus-exam/categories', label: '校招笔试题库', icon: FileText, permission: 'admin:job:manage' },
  { href: '/admin/jobs-deduplication', label: '招聘公告智能去重', icon: ListChecks, permission: 'admin:job:manage' },
  { href: '/admin/normalization-dictionary', label: '标准化词典中心', icon: Settings2, permission: 'admin:job:manage' },
  { href: '/admin/jobs-recommendation-config', label: '专属推荐权重配置', icon: Settings2, permission: 'admin:job:manage' },
  { href: '/admin/users', label: '用户管理', icon: Users, permission: 'admin:user:manage' },
  { href: '/admin/memberships', label: '会员管理', icon: Crown, permission: 'admin:membership:manage' },
  { href: '/admin/member-roles', label: 'C端会员角色权限', icon: Settings2, permission: 'admin:membership:manage' },
  { href: '/admin/membership-content', label: 'HTML通用内容管理', icon: FileText, permission: 'admin:membership:manage' },
  { href: '/admin/site-config-assets', label: '网站运营配置文件', icon: FileText, permission: 'admin:service:manage' },
  { href: '/admin/ai-model-configs', label: 'AI模型配置', icon: Settings2, permission: 'admin:ai:manage' },
  { href: '/admin/redeem-batches', label: '兑换码批次', icon: Ticket, permission: 'admin:redeem:manage' },
  { href: '/admin/redeem-codes', label: '会员兑换码', icon: ListChecks, permission: 'admin:redeem:manage' },
  { href: '/admin/resume-template-configs', label: '简历模板排版配置', icon: Settings2, permission: 'admin:service:manage' },
  { href: '/admin/service-products', label: '服务商品管理', icon: ShoppingBag, permission: 'admin:service:manage' },
  { href: '/admin/orders', label: '服务订单管理', icon: Receipt, permission: 'admin:service:manage' },
  { href: '/admin/commission-logs', label: '激励金流水管理', icon: Coins, permission: 'admin:commission:manage' },
  { href: '/admin/commission-config', label: '激励金配置', icon: Settings2, permission: 'admin:commission:manage' },
] as const;

function hasPermission(session: AdminAuthSession | null, permission: string) {
  if (!session) return false;
  return session.admin.isSuperAdmin || session.admin.permissions.includes(permission);
}

function isMenuActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === '/admin/login';
  const [session, setSession] = useState<AdminAuthSession | null>(null);
  const [bootstrapStatus, setBootstrapStatus] = useState<AdminBootstrapStatus | null>(null);
  const [bootstrapClosing, setBootstrapClosing] = useState(false);
  const [bootstrapMessage, setBootstrapMessage] = useState('');
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      setBooting(true);
      try {
        const [result, status] = await Promise.all([
          clientFetch<AdminAuthSession>('/admin/auth/me'),
          clientFetch<AdminBootstrapStatus>('/admin/auth/bootstrap-status'),
        ]);
        if (!active) return;
        setSession(result);
        setBootstrapStatus(status);
        if (isLoginPage) {
          router.replace('/admin/overview');
        }
      } catch {
        if (!active) return;
        setSession(null);
        if (!isLoginPage) {
          router.replace('/admin/login');
        }
      } finally {
        if (active) {
          setBooting(false);
        }
      }
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, [isLoginPage, pathname, router]);

  const visibleMenus = useMemo(
    () => adminMenus.filter((item) => hasPermission(session, item.permission)),
    [session],
  );
  const canCloseBootstrapEntry = Boolean(
    session && (session.admin.isSuperAdmin || session.admin.permissions.includes('admin:admin-user:manage')),
  );

  const handleLogout = () => {
    clearAdminToken();
    setSession(null);
    router.replace('/admin/login');
    router.refresh();
  };

  const handleCloseBootstrapEntry = async () => {
    setBootstrapClosing(true);
    setBootstrapMessage('');
    try {
      const result = await clientFetch<AdminBootstrapStatus>('/admin/auth/bootstrap-close', {
        method: 'POST',
      });
      setBootstrapStatus(result);
      setBootstrapMessage('管理员初始化入口已永久关闭。');
    } catch (error) {
      setBootstrapMessage(error instanceof Error ? error.message : '关闭管理员初始化入口失败');
    } finally {
      setBootstrapClosing(false);
    }
  };

  if (isLoginPage) {
    if (booting) {
      return (
        <div className="mx-auto flex min-h-screen max-w-[960px] items-center justify-center px-4 py-10">
          <Card className="w-full max-w-md p-8 text-center">
            <p className="text-lg font-semibold text-ink">正在检查后台登录状态...</p>
            <p className="mt-2 text-sm text-muted">如果已登录，将自动跳转到后台首页。</p>
          </Card>
        </div>
      );
    }
    return <>{children}</>;
  }

  if (booting || !session) {
    return (
      <div className="mx-auto flex min-h-screen max-w-[960px] items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md p-8 text-center">
          <p className="text-lg font-semibold text-ink">后台鉴权中...</p>
          <p className="mt-2 text-sm text-muted">正在加载管理员权限与可访问菜单。</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-ink">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-4 lg:flex-row lg:gap-6 lg:px-6 lg:py-6">
        <aside className="w-full shrink-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-card lg:sticky lg:top-6 lg:w-[280px] lg:self-start">
          <div className="border-b border-slate-100 pb-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-brand">
              <ShieldCheck className="h-3.5 w-3.5" />
              offer360 admin
            </div>
            <h1 className="mt-3 text-2xl font-bold text-ink">后台管理台</h1>
            <p className="mt-1 text-sm text-muted">已接入管理员登录、权限控制、兑换码后台与批量导入导出</p>
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-ink">{session.admin.realName || session.admin.username}</p>
            <p className="mt-1 text-xs text-slate-500">账号：{session.admin.username}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {session.admin.roles.map((role) => (
                <span key={role.id} className="rounded-full bg-white px-3 py-1 text-xs text-slate-600 shadow-sm">
                  {role.name}
                </span>
              ))}
            </div>
          </div>

          {canCloseBootstrapEntry ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-ink">管理员初始化入口</p>
              <p className="mt-1 text-xs text-slate-500">
                {bootstrapStatus?.registerEntryClosed
                  ? '当前已永久关闭，即使后续管理员表为空也不会再出现初始化注册入口。'
                  : '当前处于可用状态。当管理员表为空时，登录页会自动弹出初始化注册弹窗。'}
              </p>
              <Button
                className="mt-3 w-full"
                variant="secondary"
                onClick={handleCloseBootstrapEntry}
                disabled={bootstrapClosing || bootstrapStatus?.registerEntryClosed}
              >
                {bootstrapStatus?.registerEntryClosed ? '初始化入口已关闭' : bootstrapClosing ? '关闭中...' : '永久关闭初始化入口'}
              </Button>
              {bootstrapMessage ? <p className="mt-2 text-xs text-slate-500">{bootstrapMessage}</p> : null}
            </div>
          ) : null}

          <nav className="mt-4 hidden flex-col gap-2 lg:flex">
            {visibleMenus.map((item) => {
              const Icon = item.icon;
              const active = isMenuActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition',
                    active ? 'bg-brand text-white shadow-card' : 'text-slate-600 hover:bg-brand/10 hover:text-brand',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="-mx-1 mt-4 overflow-x-auto lg:hidden">
            <div className="flex min-w-max gap-2 px-1">
              {visibleMenus.map((item) => {
                const Icon = item.icon;
                const active = isMenuActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition',
                      active ? 'bg-brand text-white' : 'bg-slate-50 text-slate-600',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <Button className="mt-4 w-full" variant="secondary" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            退出后台
          </Button>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
