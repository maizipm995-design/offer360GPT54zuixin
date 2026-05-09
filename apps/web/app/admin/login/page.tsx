'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { persistAdminToken } from '@/lib/admin-auth';
import { clientFetch } from '@/lib/api';
import { AdminAuthSession, AdminBootstrapStatus } from '@/types';

export default function AdminLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ account: '', password: '' });
  const [bootstrapForm, setBootstrapForm] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    realName: '',
  });
  const [bootstrapStatus, setBootstrapStatus] = useState<AdminBootstrapStatus | null>(null);
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [bootstrapSubmitting, setBootstrapSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bootstrapError, setBootstrapError] = useState('');

  const shouldShowBootstrapDialog = useMemo(
    () => Boolean(bootstrapStatus?.shouldShowRegister),
    [bootstrapStatus],
  );

  useEffect(() => {
    let active = true;

    const loadBootstrapStatus = async () => {
      setBootstrapLoading(true);
      try {
        const result = await clientFetch<AdminBootstrapStatus>('/admin/auth/bootstrap-status');
        if (!active) return;
        setBootstrapStatus(result);
      } catch (err) {
        if (!active) return;
        setBootstrapError(err instanceof Error ? err.message : '管理员初始化状态获取失败');
      } finally {
        if (active) {
          setBootstrapLoading(false);
        }
      }
    };

    void loadBootstrapStatus();

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await clientFetch<AdminAuthSession & { token: string }>('/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      persistAdminToken(result.token);
      router.replace('/admin/overview');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '后台登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleBootstrapSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBootstrapSubmitting(true);
    setBootstrapError('');

    if (bootstrapForm.password !== bootstrapForm.confirmPassword) {
      setBootstrapSubmitting(false);
      setBootstrapError('两次输入的密码不一致');
      return;
    }

    try {
      const result = await clientFetch<AdminAuthSession & { token: string }>('/admin/auth/bootstrap-register', {
        method: 'POST',
        body: JSON.stringify({
          username: bootstrapForm.username,
          password: bootstrapForm.password,
          realName: bootstrapForm.realName,
        }),
      });
      persistAdminToken(result.token);
      setBootstrapStatus({
        hasAdminAccounts: true,
        adminCount: 1,
        registerEntryClosed: false,
        shouldShowRegister: false,
      });
      router.replace('/admin/overview');
      router.refresh();
    } catch (err) {
      setBootstrapError(err instanceof Error ? err.message : '管理员初始化失败');
    } finally {
      setBootstrapSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-[1366px] items-center px-4 py-10 lg:px-8">
      <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[32px] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-8 text-white shadow-card lg:p-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-white/85">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            offer360 后台安全入口
          </div>
          <h1 className="mt-6 text-3xl font-bold leading-tight lg:text-5xl">管理员登录后即可进入后台运营中台</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-white/80 lg:text-base">
            本次已接入管理员专用登录态、角色权限校验、兑换码后台与批量导入导出能力。若系统首次部署且尚无管理员账号，将自动进入管理员初始化注册流程。
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-semibold text-white">初始化规则</p>
              <p className="mt-2 text-sm text-white/80">当后台管理员表为空时，系统自动弹出管理员注册弹窗。</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-semibold text-white">注册入口关闭</p>
              <p className="mt-2 text-sm text-white/80">后台登录后可手动永久关闭管理员初始化入口。</p>
            </div>
          </div>
        </div>

        <Card className="p-6 lg:p-8">
          <h2 className="text-2xl font-bold text-ink">登录后台</h2>
          <p className="mt-2 text-sm text-muted">请输入管理员账号与密码，系统将自动校验权限并进入可访问菜单。</p>
          {bootstrapLoading ? (
            <p className="mt-3 text-sm text-slate-500">正在检查管理员初始化状态...</p>
          ) : null}
          {!bootstrapLoading && bootstrapStatus && !bootstrapStatus.hasAdminAccounts && bootstrapStatus.registerEntryClosed ? (
            <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
              当前系统尚无管理员账号，且初始化注册入口已被永久关闭。请联系运维处理。
            </p>
          ) : null}
          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-medium text-ink">管理员账号</label>
              <Input value={form.account} onChange={(e) => setForm((prev) => ({ ...prev, account: e.target.value }))} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-ink">登录密码</label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              />
            </div>
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? '登录中...' : '进入后台'}
            </Button>
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          </form>
        </Card>
      </div>

      {shouldShowBootstrapDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-8">
          <Card className="w-full max-w-lg p-6 lg:p-8">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-brand/10 p-3 text-brand">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-ink">初始化首个管理员账号</h3>
                <p className="mt-1 text-sm text-muted">检测到后台暂无管理员账号，请先完成首个超级管理员注册。</p>
              </div>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleBootstrapSubmit}>
              <div>
                <label className="mb-2 block text-sm font-medium text-ink">管理员账号</label>
                <Input
                  value={bootstrapForm.username}
                  onChange={(e) => setBootstrapForm((prev) => ({ ...prev, username: e.target.value }))}
                  placeholder="请输入管理员账号"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-ink">真实姓名</label>
                <Input
                  value={bootstrapForm.realName}
                  onChange={(e) => setBootstrapForm((prev) => ({ ...prev, realName: e.target.value }))}
                  placeholder="可选，便于后台识别"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-ink">登录密码</label>
                <Input
                  type="password"
                  value={bootstrapForm.password}
                  onChange={(e) => setBootstrapForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="至少 8 位"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-ink">确认密码</label>
                <Input
                  type="password"
                  value={bootstrapForm.confirmPassword}
                  onChange={(e) => setBootstrapForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                />
              </div>

              <Button className="w-full" type="submit" disabled={bootstrapSubmitting}>
                {bootstrapSubmitting ? '初始化中...' : '完成管理员初始化'}
              </Button>
              {bootstrapError ? <p className="text-sm text-rose-600">{bootstrapError}</p> : null}
            </form>
          </Card>
        </div>
      ) : null}
    </main>
  );
}
