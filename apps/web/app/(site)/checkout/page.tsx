'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { clientFetch } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { showToast, useGlobalToast } from '@/store/toast-store';
import { AuthUser, CheckoutOrder, CheckoutPrepareResult, WechatJsapiParams } from '@/types';

declare global {
  interface Window {
    WeixinJSBridge?: {
      invoke: (name: string, payload: Record<string, unknown>, callback: (result: { err_msg?: string }) => void) => void;
    };
  }
}

function getStatusLabel(order: CheckoutOrder) {
  if (order.payStatus === 'paid') return '已支付';
  if (order.payStatus === 'refund_pending') return '退款处理中';
  if (order.payStatus === 'closed') return '已关闭';
  if (order.payStatus === 'refunded') return '已退款';
  return '待支付';
}

function getStatusClassName(order: CheckoutOrder) {
  if (order.payStatus === 'paid') return 'text-brand';
  if (order.payStatus === 'refund_pending') return 'text-amber-600';
  if (order.payStatus === 'closed' || order.payStatus === 'refunded') return 'text-slate-500';
  return 'text-red-500';
}

async function waitForWeixinBridge() {
  if (typeof window === 'undefined') {
    throw new Error('当前环境不支持微信支付');
  }
  if (window.WeixinJSBridge) {
    return window.WeixinJSBridge;
  }

  return new Promise<NonNullable<Window['WeixinJSBridge']>>((resolve) => {
    const handleReady = () => {
      if (window.WeixinJSBridge) {
        document.removeEventListener('WeixinJSBridgeReady', handleReady);
        resolve(window.WeixinJSBridge);
      }
    };
    document.addEventListener('WeixinJSBridgeReady', handleReady, { once: true });
  });
}

async function invokeWechatJsapi(params: WechatJsapiParams) {
  const bridge = await waitForWeixinBridge();
  return new Promise<{ err_msg?: string }>((resolve) => {
    bridge.invoke('getBrandWCPayRequest', params as unknown as Record<string, unknown>, resolve);
  });
}

function CheckoutPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, updateUser } = useAuthStore();
  const [order, setOrder] = useState<CheckoutOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [message, setMessage] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const orderNo = useMemo(() => searchParams.get('orderNo')?.trim() ?? '', [searchParams]);
  const productId = useMemo(() => searchParams.get('productId')?.trim() ?? '', [searchParams]);
  const oauthReady = searchParams.get('oauth') === '1';
  const wxReturned = searchParams.get('wxReturn') === '1';
  const autoPrepareRef = useRef(false);
  const createOrderTriggeredRef = useRef(false);
  const pollTimerRef = useRef<number | null>(null);

  useGlobalToast(message, setMessage);

  const stopPolling = () => {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const refreshAuthUser = async () => {
    if (!token) return;
    try {
      const authUser = await clientFetch<AuthUser>('/auth/me', {}, token);
      updateUser(authUser);
    } catch {
      // 用户态刷新失败不影响支付结果页展示。
    }
  };

  const loadOrder = async (silent = false) => {
    if (!token || !orderNo) {
      return null;
    }
    if (!silent) {
      setLoading(true);
    }
    try {
      const nextOrder = await clientFetch<CheckoutOrder>(`/payments/orders/${orderNo}`, {}, token);
      setOrder(nextOrder);
      return nextOrder;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '订单加载失败');
      return null;
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const createOrderFromProduct = async () => {
    if (!token || !productId) {
      return null;
    }
    setCreatingOrder(true);
    setLoading(true);
    try {
      const result = await clientFetch<{ order: CheckoutOrder }>(
        '/payments/orders',
        {
          method: 'POST',
          body: JSON.stringify({
            productId,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          }),
        },
        token,
      );
      setOrder(result.order);
      return result.order;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '创建订单失败');
      return null;
    } finally {
      setCreatingOrder(false);
      setLoading(false);
    }
  };

  const startPolling = () => {
    stopPolling();
    let attempts = 0;
    pollTimerRef.current = window.setInterval(async () => {
      attempts += 1;
      const nextOrder = await loadOrder(true);
      if (!nextOrder) {
        if (attempts >= 10) {
          stopPolling();
        }
        return;
      }
      if (nextOrder.payStatus !== 'unpaid') {
        stopPolling();
        if (nextOrder.payStatus === 'paid') {
          await refreshAuthUser();
          showToast('支付成功。', 'success');
        }
        return;
      }
      if (attempts >= 20) {
        stopPolling();
      }
    }, 3000);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    if (!orderNo) {
      return;
    }
    void loadOrder();
    return stopPolling;
  }, [token, orderNo]); // eslint-disable-line react-hooks/exhaustive-deps

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!token || orderNo || !productId || createOrderTriggeredRef.current) {
      if (!token || (!orderNo && !productId)) {
        setLoading(false);
      }
      return;
    }
    createOrderTriggeredRef.current = true;
    void createOrderFromProduct().then((createdOrder) => {
      if (createdOrder?.checkoutPath) {
        router.replace(createdOrder.checkoutPath);
      } else {
        createOrderTriggeredRef.current = false;
      }
    });
  }, [token, orderNo, productId, router]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!order?.wechatCodeUrl) {
      setQrCodeDataUrl('');
      return;
    }
    QRCode.toDataURL(order.wechatCodeUrl, {
      width: 260,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then(setQrCodeDataUrl)
      .catch(() => setQrCodeDataUrl(''));
  }, [order?.wechatCodeUrl]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (wxReturned && order?.payStatus === 'unpaid') {
      startPolling();
    }
  }, [wxReturned, order?.id, order?.payStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!oauthReady || autoPrepareRef.current || !order || order.payStatus !== 'unpaid') {
      return;
    }
    autoPrepareRef.current = true;
    void handlePreparePayment();
  }, [oauthReady, order?.id, order?.payStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePrepareResult = async (result: CheckoutPrepareResult) => {
    setOrder(result.order);

    if (result.action === 'already_paid') {
      await refreshAuthUser();
      showToast('订单已支付。');
      return;
    }

    if (result.action === 'closed') {
      setMessage('该订单已关闭，请重新下单。');
      return;
    }

    if (result.action === 'oauth_redirect_required') {
      if (!result.oauthUrl) {
        setMessage('暂时无法发起支付，请稍后重试。');
        return;
      }
      window.location.href = result.oauthUrl;
      return;
    }

    if (result.action === 'redirect_h5') {
      const target = result.h5Url || result.order.wechatH5Url;
      if (!target) {
        setMessage('暂时无法发起支付，请稍后重试。');
        return;
      }
      window.location.href = target;
      return;
    }

    if (result.action === 'invoke_jsapi') {
      if (!result.jsapiParams) {
        setMessage('暂时无法发起支付，请稍后重试。');
        return;
      }
      const payResult = await invokeWechatJsapi(result.jsapiParams);
      const messageText = payResult.err_msg || '';
      if (messageText.includes('ok')) {
        setMessage('支付请求已发起，请稍候。');
        startPolling();
        return;
      }
      if (messageText.includes('cancel')) {
        setMessage('已取消支付。');
        return;
      }
      throw new Error(messageText || '支付拉起失败');
    }

    if (result.action === 'show_qrcode') {
      setMessage('请扫码完成支付。');
      startPolling();
    }
  };

  const handlePreparePayment = async () => {
    if (!token || !orderNo) {
      setMessage('订单信息异常，请返回后重试。');
      return;
    }

    setPreparing(true);
    try {
      const result = await clientFetch<CheckoutPrepareResult>(
        `/payments/orders/${orderNo}/prepare`,
        {
          method: 'POST',
          body: JSON.stringify({
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
            returnPath: `/checkout?orderNo=${encodeURIComponent(orderNo)}`,
          }),
        },
        token,
      );
      await handlePrepareResult(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '发起支付失败');
    } finally {
      setPreparing(false);
    }
  };

  const handleCloseOrder = async () => {
    if (!token || !orderNo) return;
    setClosing(true);
    try {
      const closed = await clientFetch<CheckoutOrder>(`/payments/orders/${orderNo}/close`, { method: 'POST' }, token);
      setOrder(closed);
      stopPolling();
      setMessage('订单已关闭，如需继续购买请重新下单。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '关闭订单失败');
    } finally {
      setClosing(false);
    }
  };

  if (!token) {
    const redirectTarget = orderNo
      ? `/checkout?orderNo=${encodeURIComponent(orderNo)}`
      : productId
        ? `/checkout?productId=${encodeURIComponent(productId)}`
        : '/checkout';
    return (
      <main className="mx-auto max-w-[1366px] px-4 py-10 lg:px-8">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold text-ink">请先登录</h1>
          <Button className="mt-6" onClick={() => router.push(`/login?redirect=${encodeURIComponent(redirectTarget)}`)}>前往登录</Button>
        </Card>
      </main>
    );
  }

  if (!orderNo && !productId) {
    return (
      <main className="mx-auto max-w-[1366px] px-4 py-10 lg:px-8">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold text-ink">缺少支付商品</h1>
          <p className="mt-3 text-sm text-muted">请从会员页、服务详情页或个人中心重新进入支付页。</p>
        </Card>
      </main>
    );
  }

  if ((loading || creatingOrder) && !order) {
    return <main className="mx-auto max-w-[1366px] px-4 py-10 lg:px-8">{creatingOrder ? '订单创建中...' : '订单加载中...'}</main>;
  }

  if (!order) {
    return <main className="mx-auto max-w-[960px] px-4 py-10 lg:px-8">{message || '订单不存在'}</main>;
  }

  return (
    <main className="mx-auto max-w-[1366px] px-4 py-8 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_360px]">
        <Card className="p-6 lg:p-8">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm text-muted">订单号 {order.orderNo}</p>
              <h1 className="mt-2 text-3xl font-bold text-ink">订单支付</h1>
            </div>
            <div className="rounded-2xl bg-slate-50 px-5 py-4">
              <p className="text-sm text-muted">当前状态</p>
              <p className={`mt-2 text-2xl font-bold ${getStatusClassName(order)}`}>{getStatusLabel(order)}</p>
              <p className="mt-2 text-xs text-muted">{order.expireAt ? `支付截止：${formatDate(order.expireAt)}` : '订单尚未生成支付截止时间'}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 rounded-3xl bg-slate-50 p-5 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted">商品名称</p>
              <p className="mt-2 text-lg font-semibold text-ink">{order.title}</p>
            </div>
            <div>
              <p className="text-sm text-muted">支付金额</p>
              <p className="mt-2 text-3xl font-black text-brand">{formatCurrency(order.amount)}</p>
            </div>
            <div>
              <p className="text-sm text-muted">订单类型</p>
              <p className="mt-2 font-semibold text-ink">{order.orderType === 'membership' ? `${order.memberLevelLabel} 会员订单` : '求职服务订单'}</p>
            </div>
            <div>
              <p className="text-sm text-muted">下单时间</p>
              <p className="mt-2 font-semibold text-ink">{formatDate(order.createdAt)}</p>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-slate-200 p-5">
            <h2 className="text-lg font-bold text-ink">支付操作</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {order.payStatus === 'unpaid' ? (
                <Button onClick={handlePreparePayment} disabled={preparing}>{preparing ? '正在发起支付...' : '立即支付'}</Button>
              ) : null}
              {order.payStatus === 'unpaid' ? (
                <Button variant="secondary" onClick={() => void loadOrder(true)}>刷新状态</Button>
              ) : null}
              {order.payStatus === 'unpaid' ? (
                <Button variant="secondary" onClick={handleCloseOrder} disabled={closing}>{closing ? '关闭中...' : '关闭订单'}</Button>
              ) : null}
              {order.payStatus !== 'unpaid' ? (
                <Button onClick={() => router.push(order.serviceEntryUrl)}>{order.entryLabel}</Button>
              ) : null}
              <Button variant="secondary" onClick={() => router.push('/personal-center#orders')}>返回我的订单</Button>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          {order.payStatus === 'unpaid' && qrCodeDataUrl ? (
            <Card className="p-6 text-center">
              <h2 className="text-lg font-bold text-ink">请使用微信扫码支付</h2>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCodeDataUrl} alt="微信支付二维码" className="mx-auto mt-5 h-[260px] w-[260px] rounded-2xl border border-slate-100 p-3" />
              <p className="mt-4 text-sm text-muted">支付后页面会自动更新；如未更新，可点击“刷新状态”。</p>
            </Card>
          ) : null}

          {order.payStatus === 'paid' ? (
            <Card className="p-6">
              <h2 className="text-lg font-bold text-ink">支付完成</h2>
              <p className="mt-3 text-sm leading-6 text-muted">支付成功时间：{formatDate(order.payTime || undefined)}</p>
            </Card>
          ) : null}

          {order.payStatus === 'refund_pending' ? (
            <Card className="p-6">
              <h2 className="text-lg font-bold text-ink">退款处理中</h2>
              <p className="mt-3 text-sm leading-6 text-muted">退款申请已提交，请稍后在个人中心查看最新状态。</p>
            </Card>
          ) : null}
        </div>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-[960px] px-4 py-10 lg:px-8">订单加载中...</main>}>
      <CheckoutPageClient />
    </Suspense>
  );
}
