import { ServicePurchaseActions } from '@/components/services/service-purchase-actions';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import type { ServiceItem } from '@/types';

export function ServiceDetailPageClient({ service }: { service: ServiceItem }) {
  const hasRating = service.score > 0;
  const hasSalesCount = service.salesCount > 0;

  return (
    <main className="mx-auto max-w-[1366px] px-4 py-8 lg:px-8 lg:py-10">
      <div className="space-y-6 lg:space-y-8">
        <Card className="overflow-hidden rounded-[32px] border border-slate-200 bg-white p-6 shadow-card lg:p-10">
          <div className="flex flex-wrap items-center gap-3">
            <Badge>{service.isHot ? '热销服务' : '优选服务'}</Badge>
            {hasRating ? <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">评分 {service.score}</span> : null}
            {hasSalesCount ? <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">{service.salesCount} 人付款</span> : null}
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
                {service.originalPrice > service.price ? (
                  <span className="pb-1 text-sm text-muted line-through">原价 {formatCurrency(service.originalPrice)}</span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="rounded-3xl border border-amber-100 bg-amber-50/70 p-5 text-sm leading-7 text-slate-600">
              <p className="font-semibold text-ink">服务提示</p>
              <p className="mt-2">下单成功后，可在个人中心「我的订单」查看订单状态，并通过“服务入口”弹窗查看该商品对应的服务说明和操作指引。</p>
            </div>

            <ServicePurchaseActions serviceId={service.id} />
          </div>
        </Card>

        <Card className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-card lg:p-10">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-5">
            <div>
              <h2 className="text-2xl font-bold text-ink lg:text-3xl">服务详情</h2>
              <p className="mt-2 text-sm text-muted">当前页面内容与商品库录入数据同步，完整展示服务内容、优势、流程与交付权益。</p>
            </div>
          </div>

          {service.detailHtml?.trim() ? (
            <div
              className="rich-html-content service-rich-content mt-8 w-full overflow-x-auto text-sm lg:text-base"
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
