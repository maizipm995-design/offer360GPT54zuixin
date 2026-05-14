'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { clientFetch } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { useGlobalToast } from '@/store/toast-store';
import type { AuthUser } from '@/types';

type AuthBusiness = 'login' | 'register' | 'reset_password';
type AuthStep = 'phone' | 'existing-password' | 'existing-code' | 'register-code' | 'register-password' | 'reset-code' | 'reset-password';

interface IdentifyPhoneResult {
  phone: string;
  registered: boolean;
}

interface SendAuthCodeResult {
  business: AuthBusiness;
  businessLabel: string;
  phone: string;
  expiresAt: string;
  reused: boolean;
  sent: boolean;
  cooldownSeconds: number;
  deliveryMode?: 'aliyun' | 'mock';
  debugCode?: string;
}

interface VerifyAuthCodeResult {
  business: AuthBusiness;
  businessLabel: string;
  verified: boolean;
  expiresAt: string;
}

interface AuthActionResult {
  token: string;
  user: AuthUser;
}

const LOGIN_LOGO_URL = 'https://i.postimg.cc/J05Dn45v/sun-lao-shilogo-192X192.png';

const STEP_TITLE: Record<AuthStep, string> = {
  phone: '输入手机号',
  'existing-password': '密码登录',
  'existing-code': '验证码登录',
  'register-code': '输入验证码',
  'register-password': '设置登录密码',
  'reset-code': '验证身份',
  'reset-password': '重置密码',
};

function buildRedirectHref(basePath: string, inviteToken: string, inviteCode: string) {
  if (!inviteToken && !inviteCode) {
    return basePath;
  }

  const searchParams = new URLSearchParams();
  if (inviteToken) {
    searchParams.set('inviteToken', inviteToken);
  }
  if (inviteCode) {
    searchParams.set('inviteCode', inviteCode);
  }
  return `${basePath}?${searchParams.toString()}`;
}

function UnifiedAuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);
  const redirectPath = useMemo(() => searchParams.get('redirect') || '/', [searchParams]);
  const inviteToken = useMemo(() => (searchParams.get('inviteToken') || '').trim().toUpperCase(), [searchParams]);
  const inviteCode = useMemo(() => (searchParams.get('inviteCode') || '').trim().toUpperCase(), [searchParams]);
  const [step, setStep] = useState<AuthStep>('phone');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [message, setMessage] = useState('');

  useGlobalToast(message, setMessage, (message?.includes('成功') || message?.includes('已发送')) ? 'success' : 'error');

  useEffect(() => {
    if (countdown <= 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [countdown]);

  const authButtonText = step === 'existing-password'
    ? (loading ? '登录中...' : '立即登录')
    : step === 'existing-code'
      ? (loading ? '登录中...' : '验证码登录')
      : step === 'register-code'
        ? (loading ? '验证中...' : '验证并继续')
        : step === 'register-password'
          ? (loading ? '注册中...' : '完成注册')
          : step === 'reset-code'
            ? (loading ? '验证中...' : '验证并继续')
            : step === 'reset-password'
              ? (loading ? '提交中...' : '完成重置')
              : (loading ? '识别中...' : '下一步');

  const resetToPhoneStep = () => {
    setStep('phone');
    setPassword('');
    setVerificationCode('');
    setCountdown(0);
  };

  const startCooldown = (seconds: number) => {
    setCountdown(Math.max(0, seconds));
  };

  const sendCode = async (business: AuthBusiness) => {
    setSendingCode(true);
    try {
      const result = await clientFetch<SendAuthCodeResult>('/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ phone: phone.trim(), business }),
      });
      startCooldown(result.cooldownSeconds || 60);
      if (result.deliveryMode === 'mock' && result.debugCode) {
        setMessage(`开发环境未接短信通道，本次验证码：${result.debugCode}`);
      } else {
        setMessage('验证码已发送，请注意查收。');
      }
      return result;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '验证码发送失败，请稍后重试');
      throw error;
    } finally {
      setSendingCode(false);
    }
  };

  const finishAuth = (result: AuthActionResult, fallbackPath = redirectPath) => {
    setAuth(result);
    router.replace(searchParams.get('redirect') || fallbackPath);
  };

  const handleIdentify = async (targetPhone?: string) => {
    const phoneToIdentify = (targetPhone || phone).trim();
    if (phoneToIdentify.length !== 11) return;

    setLoading(true);
    try {
      const result = await clientFetch<IdentifyPhoneResult>('/auth/identify', {
        method: 'POST',
        body: JSON.stringify({ phone: phoneToIdentify }),
      });

      setVerificationCode('');
      setPassword('');
      setCountdown(0);

      if (result.registered) {
        // 如果是已注册，且当前步骤不是登录相关的，切到密码登录
        if (step !== 'existing-password' && step !== 'existing-code') {
          setStep('existing-password');
        }
        return;
      }

      // 未注册，切到注册验证码步骤
      setStep('register-code');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '手机号识别失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneBlur = () => {
    // 仅在非初始步骤且手机号长度为 11 位时触发自动识别
    if (step !== 'phone' && phone.trim().length === 11) {
      void handleIdentify();
    }
  };

  const handleIdentifyForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await handleIdentify();
  };

  const handlePasswordLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await clientFetch<AuthActionResult>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phone: phone.trim(), password: password.trim() }),
      });
      finishAuth(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeLoginMode = () => {
    setStep('existing-code');
    setVerificationCode('');
  };

  const handleCodeLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await clientFetch<AuthActionResult>('/auth/login/code', {
        method: 'POST',
        body: JSON.stringify({ phone: phone.trim(), code: verificationCode.trim() }),
      });
      finishAuth(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '验证码登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyRegisterCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      await clientFetch<VerifyAuthCodeResult>('/auth/verify-code', {
        method: 'POST',
        body: JSON.stringify({ phone: phone.trim(), business: 'register', code: verificationCode.trim() }),
      });
      setStep('register-password');
      setMessage('验证码验证成功，请设置登录密码。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '验证码校验失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await clientFetch<AuthActionResult>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          phone: phone.trim(),
          password: password.trim(),
          inviteToken: inviteToken || undefined,
          inviteCode: inviteCode || undefined,
          verificationCode: verificationCode.trim(),
        }),
      });
      finishAuth(result, '/');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '注册失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    setVerificationCode('');
    setPassword('');
    setStep('reset-code');
  };

  const handleVerifyResetCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      await clientFetch<VerifyAuthCodeResult>('/auth/verify-code', {
        method: 'POST',
        body: JSON.stringify({ phone: phone.trim(), business: 'reset_password', code: verificationCode.trim() }),
      });
      setStep('reset-password');
      setMessage('验证码验证成功，请设置新密码。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '验证码校验失败');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await clientFetch<AuthActionResult>('/auth/password/reset', {
        method: 'POST',
        body: JSON.stringify({ phone: phone.trim(), code: verificationCode.trim(), newPassword: password.trim() }),
      });
      finishAuth(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '密码重置失败');
    } finally {
      setLoading(false);
    }
  };

  const renderStepForm = () => {
    return (
      <div className="mt-8 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-ink">手机号</label>
          <Input
            inputMode="numeric"
            maxLength={11}
            placeholder="请输入你的手机号"
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value.replace(/\D/g, '').slice(0, 11));
            }}
            onBlur={handlePhoneBlur}
          />
        </div>

        {step === 'phone' && (
          <form onSubmit={handleIdentifyForm}>
            <Button className="w-full" type="submit" disabled={loading || phone.trim().length !== 11}>
              {authButtonText}
            </Button>
          </form>
        )}

        {step === 'existing-password' && (
          <form className="space-y-4" onSubmit={handlePasswordLogin}>
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
              <button type="button" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-brand shadow-sm">密码登录</button>
              <button type="button" className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 transition hover:text-brand" onClick={handleCodeLoginMode} disabled={sendingCode || loading}>
                验证码登录
              </button>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-ink">登录密码</label>
              <Input type="text" placeholder="请输入登录密码" value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <button type="button" className="font-medium text-brand hover:underline" onClick={handleForgotPassword}>
                忘记密码
              </button>
              <button type="button" className="text-slate-500 hover:text-brand" onClick={resetToPhoneStep}>
                重输号码
              </button>
            </div>
            <Button className="w-full" type="submit" disabled={loading || password.trim().length < 8 || phone.trim().length !== 11}>
              {authButtonText}
            </Button>
          </form>
        )}

        {step === 'existing-code' && (
          <form className="space-y-4" onSubmit={handleCodeLogin}>
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
              <button type="button" className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 transition hover:text-brand" onClick={() => setStep('existing-password')}>
                密码登录
              </button>
              <button type="button" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-brand shadow-sm">验证码登录</button>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-ink">短信验证码</label>
              <div className="flex gap-3">
                <Input className="flex-1" inputMode="numeric" maxLength={8} placeholder="请输入验证码" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 8))} />
                <Button type="button" variant="secondary" className="min-w-[132px]" disabled={sendingCode || countdown > 0 || phone.trim().length !== 11} onClick={() => void sendCode('login')}>
                  {countdown > 0 ? `${countdown}s 后重发` : sendingCode ? '发送中...' : '获取验证码'}
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-500">
              <button type="button" className="font-medium text-brand hover:underline" onClick={handleForgotPassword}>忘记密码</button>
              <button type="button" className="hover:text-brand" onClick={resetToPhoneStep}>重输号码</button>
            </div>
            <Button className="w-full" type="submit" disabled={loading || verificationCode.trim().length < 4 || phone.trim().length !== 11}>
              {authButtonText}
            </Button>
          </form>
        )}

        {step === 'register-code' && (
          <form className="space-y-4" onSubmit={handleVerifyRegisterCode}>
            <div>
              <label className="mb-2 block text-sm font-medium text-ink">验证码</label>
              <div className="flex gap-3">
                <Input className="flex-1" inputMode="numeric" maxLength={8} placeholder="请输入验证码" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 8))} />
                <Button type="button" variant="secondary" className="min-w-[132px]" disabled={sendingCode || countdown > 0 || phone.trim().length !== 11} onClick={() => void sendCode('register')}>
                  {countdown > 0 ? `${countdown}s 后重发` : sendingCode ? '发送中...' : '重新发送'}
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-500">
              <button type="button" className="hover:text-brand" onClick={resetToPhoneStep}>重输号码</button>
              <Link href={buildRedirectHref('/login', inviteToken, inviteCode)} className="font-medium text-brand hover:underline">已有账号去登录</Link>
            </div>
            <Button className="w-full" type="submit" disabled={loading || verificationCode.trim().length < 4 || phone.trim().length !== 11}>
              {authButtonText}
            </Button>
          </form>
        )}

        {step === 'register-password' && (
          <form className="space-y-4" onSubmit={handleRegister}>
            <div>
              <label className="mb-2 block text-sm font-medium text-ink">登录密码</label>
              <Input type="text" placeholder="请设置 8-32 位登录密码" value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            <div className="flex items-center justify-between text-sm text-slate-500">
              <button type="button" className="hover:text-brand" onClick={() => setStep('register-code')}>返回验证码校验</button>
              <button type="button" className="hover:text-brand" onClick={resetToPhoneStep}>重输号码</button>
            </div>
            <Button className="w-full" type="submit" disabled={loading || password.trim().length < 8 || phone.trim().length !== 11}>
              {authButtonText}
            </Button>
          </form>
        )}

        {step === 'reset-code' && (
          <form className="space-y-4" onSubmit={handleVerifyResetCode}>
            <div>
              <label className="mb-2 block text-sm font-medium text-ink">验证码</label>
              <div className="flex gap-3">
                <Input className="flex-1" inputMode="numeric" maxLength={8} placeholder="请输入验证码" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 8))} />
                <Button type="button" variant="secondary" className="min-w-[132px]" disabled={sendingCode || countdown > 0 || phone.trim().length !== 11} onClick={() => void sendCode('reset_password')}>
                  {countdown > 0 ? `${countdown}s 后重发` : sendingCode ? '发送中...' : '获取验证码'}
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-500">
              <button type="button" className="hover:text-brand" onClick={() => setStep('existing-password')}>返回密码登录</button>
              <button type="button" className="hover:text-brand" onClick={resetToPhoneStep}>重输号码</button>
            </div>
            <Button className="w-full" type="submit" disabled={loading || verificationCode.trim().length < 4 || phone.trim().length !== 11}>
              {authButtonText}
            </Button>
          </form>
        )}

        {step === 'reset-password' && (
          <form className="space-y-4" onSubmit={handleResetPassword}>
            <div>
              <label className="mb-2 block text-sm font-medium text-ink">新密码</label>
              <Input type="text" placeholder="请输入 8-32 位新密码" value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            <div className="flex items-center justify-between text-sm text-slate-500">
              <button type="button" className="hover:text-brand" onClick={() => setStep('reset-code')}>返回验证码校验</button>
              <button type="button" className="hover:text-brand" onClick={resetToPhoneStep}>重输号码</button>
            </div>
            <Button className="w-full" type="submit" disabled={loading || password.trim().length < 8 || phone.trim().length !== 11}>
              {authButtonText}
            </Button>
          </form>
        )}
      </div>
    );
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-60px)] max-w-[560px] items-center justify-center px-4 py-10 lg:px-8">
      <Card className="w-full p-6 lg:p-8">
        {step !== 'phone' ? (
          <button type="button" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-brand" onClick={resetToPhoneStep}>
            <ArrowLeft className="h-4 w-4" />
            重输手机号
          </button>
        ) : null}

        <div className={step !== 'phone' ? 'mt-4' : ''}>
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="flex h-[96px] w-[96px] items-center justify-center rounded-[22px] bg-white p-0 sm:h-[120px] sm:w-[120px]">
              <Image
                src={LOGIN_LOGO_URL}
                alt="Offer360 Logo"
                width={120}
                height={120}
                className="h-full w-full object-contain"
                priority
              />
            </div>
            <p className="mt-3 text-sm font-semibold tracking-[0.18em] text-brand/80">OFFER360</p>
          </div>
          <h1 className="text-center text-3xl font-bold text-ink">{step === 'phone' ? '欢迎登录 Offer360' : STEP_TITLE[step]}</h1>
          {step === 'phone' ? <p className="mt-2 text-center text-sm text-muted">请输入手机号继续。</p> : null}
        </div>

        {renderStepForm()}
      </Card>
    </main>
  );
}

export function UnifiedAuthPageClient() {
  return (
    <Suspense fallback={<main className="mx-auto flex min-h-[calc(100vh-60px)] max-w-[560px] items-center justify-center px-4 py-10 text-sm text-muted lg:px-8">登录页加载中...</main>}>
      <UnifiedAuthPageContent />
    </Suspense>
  );
}
