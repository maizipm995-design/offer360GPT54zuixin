'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { clientFetch } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

interface OauthCompleteResult {
  orderNo: string;
  openid: string;
  checkoutPath: string;
}

function WechatOauthCallbackPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token } = useAuthStore();
  const [message, setMessage] = useState('正在处理支付，请稍候...');
  const handledRef = useRef(false);
  const code = searchParams.get('code')?.trim() ?? '';
  const orderNo = searchParams.get('orderNo')?.trim() || searchParams.get('state')?.trim() || '';
  const authError = searchParams.get('errcode') || searchParams.get('error') || '';

  useEffect(() => {
    if (!token) {
      setMessage('当前登录已失效，请重新登录后继续。');
      return;
    }
    if (handledRef.current) {
      return;
    }
    handledRef.current = true;

    if (authError || !orderNo || !code) {
      setMessage('页面信息不完整，请返回订单页后重试。');
      return;
    }

    clientFetch<OauthCompleteResult>(
      '/payments/wechat/oauth/complete',
      {
        method: 'POST',
        body: JSON.stringify({ orderNo, code }),
      },
      token,
    )
      .then((result) => {
        router.replace(`${result.checkoutPath}&oauth=1`);
      })
      .catch(() => {
        setMessage('支付处理失败，请返回订单页后重试。');
      });
  }, [authError, code, orderNo, router, token]);

  return (
    <main className="mx-auto max-w-[720px] px-4 py-10 lg:px-8">
      <Card className="p-8 text-center">
        <h1 className="text-2xl font-bold text-ink">支付处理中</h1>
        <p className="mt-4 text-sm leading-6 text-muted">{message}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="secondary" onClick={() => router.push('/personal-center#orders')}>返回我的订单</Button>
          {orderNo ? <Button onClick={() => router.push(`/checkout?orderNo=${encodeURIComponent(orderNo)}`)}>返回订单页</Button> : null}
        </div>
      </Card>
    </main>
  );
}

export default function WechatOauthCallbackPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-[720px] px-4 py-10 lg:px-8">正在处理支付...</main>}>
      <WechatOauthCallbackPageClient />
    </Suspense>
  );
}
