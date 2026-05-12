'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useGlobalToast } from '@/store/toast-store';
import type { ServiceItem } from '@/types';

export function ServiceDetailPageClient({ service }: { service: ServiceItem }) {
  const router = useRouter();
  const { token } = useAuthStore();
  const [message, setMessage] = useState('');
  const [jumpingToCheckout, setJumpingToCheckout] = useState(false);

  useGlobalToast(message, setMessage);

  const handleBuy = async () => {
    if (!token) {
      router.push(`/login?redirect=${encodeURIComponent(`/services/${encodeURIComponent(service.id)}`)}`);
      return;
    }

    setJumpingToCheckout(true);
    try {
      router.push(`/checkout?productId=${encodeURIComponent(service.id)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '跳转支付页失败');
    } finally {
      setJumpingToCheckout(false);
    }
  };

  return (
    <main className="mx-auto max-w-[1366px] px-4 py-8 lg:px-8 lg:py-10">
      <div className="space-y-6 lg:space-y-8">
        <Card className="overflow-hidden rounded-[32px] border border-slate-200 bg-white p-6 shadow-card lg:p-10">
          <div className="flex flex-wrap items-center gap-3">
            <Badge>{service.isHot ? '热销服务' : '优选服务'}</Badge>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">评分 {service.score}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">{service.salesCount} 人付款</span>
          </div>

          <div className="mt-5 flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <h1 className="text-3xl font-black tracking-tight text-ink lg:text-5xl">{service.name}</h1>
              <p className="mt-4 text-base leading-8 text-muted lg:text-lg">{service.description}</p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5 xl:min-w-[320px]">
              <p className="text-sm font-medium text-muted">当前到手价</p>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <span className="text-4xl font-black text-brand lg:text-5xl">{formatCurrency(service.price)}</span>
                <span className="pb-1 text-sm text-muted line-through">原价 {formatCurrency(service.originalPrice)}</span>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="rounded-3xl border border-amber-100 bg-amber-50/70 p-5 text-sm leading-7 text-slate-600">
              <p className="font-semibold text-ink">服务提示</p>
              <p className="mt-2">下单成功后，可在个人中心「我的订单」查看订单状态，并通过“服务入口”弹窗查看该商品对应的服务说明和操作指引。</p>
            </div>

            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Button onClick={handleBuy} disabled={jumpingToCheckout}>{jumpingToCheckout ? '跳转支付页中...' : '立即支付'}</Button>
              <Button variant="secondary" onClick={() => router.push('/services')}>返回服务列表</Button>
            </div>
          </div>
        </Card>

        <Card className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-card lg:p-10">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-5">
            <div>
              <h2 className="text-2xl font-bold text-ink lg:text-3xl">服务详情</h2>
              <p className="mt-2 text-sm text-muted">支持后台配置长图文、复杂 HTML 排版和任意长度的纵向详情内容。</p>
            </div>
          </div>

          {service.detailHtml?.trim() ? (
            <div
              className="service-rich-content mt-8 w-full overflow-x-auto text-sm leading-8 text-slate-700 lg:text-base [&_a]:text-brand [&_a]:underline [&_blockquote]:my-6 [&_blockquote]:rounded-2xl [&_blockquote]:border-l-4 [&_blockquote]:border-brand/30 [&_blockquote]:bg-brand/5 [&_blockquote]:px-5 [&_blockquote]:py-4 [&_h1]:mt-8 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_hr]:my-8 [&_img]:my-6 [&_img]:block [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-3xl [&_li]:mt-2 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:leading-8 [&_p+p]:mt-4 [&_pre]:my-6 [&_pre]:overflow-x-auto [&_pre]:rounded-2xl [&_pre]:bg-slate-950 [&_pre]:p-4 [&_pre]:text-slate-100 [&_table]:my-6 [&_table]:w-full [&_table]:min-w-[640px] [&_table]:border-collapse [&_td]:border [&_td]:border-slate-200 [&_td]:px-4 [&_td]:py-3 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-4 [&_th]:py-3 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6"
              dangerouslySetInnerHTML={{ __html: service.detailHtml }}
            />
          ) : (
            <div className="mt-8 rounded-3xl bg-slate-50 p-6 lg:p-8">
              <p className="text-sm leading-8 text-muted lg:text-base">当前商品详情正在完善中，可先查看上方基础信息或直接下单咨询。</p>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
