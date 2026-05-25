'use client';

import { useEffect, useState } from 'react';
import { AdminTable } from '@/components/admin/admin-table';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { clientFetch } from '@/lib/api';
import { ADMIN_TOAST_COPY } from '@/lib/toast-copy';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useGlobalToast } from '@/store/toast-store';
import { AdminOverviewData } from '@/types';

export default function AdminOverviewPage() {
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useGlobalToast(message, setMessage);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const result = await clientFetch<AdminOverviewData>('/admin/overview');
        setData(result);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.loadFailed('后台总览'));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Admin overview</p>
        <h2 className="text-3xl font-bold text-ink">数据总览</h2>
        <p className="text-sm text-muted">集中查看第一阶段后台的核心经营指标、最近招聘、最新订单和热销服务。</p>
      </section>

      {loading && !data ? <Card className="p-8 text-sm text-muted">正在加载后台总览数据...</Card> : null}

      {data ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {data.summaryCards.map((item) => (
              <Card key={item.label} className="rounded-3xl p-5">
                <p className="text-sm text-muted">{item.label}</p>
                <p className="mt-3 text-3xl font-bold text-ink">
                  {typeof item.value === 'number' ? item.value.toLocaleString('zh-CN') : item.value}
                </p>
                <p className="mt-3 text-xs leading-5 text-slate-500">{item.helper}</p>
              </Card>
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-3">
            <div className="space-y-3">
              <div>
                <h3 className="text-xl font-semibold text-ink">最近更新岗位</h3>
                <p className="text-sm text-muted">便于运营快速确认岗位库是否持续更新。</p>
              </div>
              <AdminTable headers={['企业', '岗位', '地区', '更新时间']} hasData={data.latestJobs.length > 0} emptyText="暂无岗位数据">
                {data.latestJobs.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-4 py-3 font-medium text-ink">{item.companyName}</td>
                    <td className="px-4 py-3 text-slate-600">{item.positionNames}</td>
                    <td className="px-4 py-3 text-slate-600">{item.workLocation}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(item.updatedAt)}</td>
                  </tr>
                ))}
              </AdminTable>
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="text-xl font-semibold text-ink">最新订单</h3>
                <p className="text-sm text-muted">方便客服和运营快速查看最近支付转化情况。</p>
              </div>
              <AdminTable headers={['订单号', '用户', '商品', '金额']} hasData={data.latestOrders.length > 0} emptyText="暂无订单数据">
                {data.latestOrders.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-4 py-3 font-medium text-ink">{item.orderNo}</td>
                    <td className="px-4 py-3 text-slate-600">{item.userPhone}</td>
                    <td className="px-4 py-3 text-slate-600">{item.productName}</td>
                    <td className="px-4 py-3 text-slate-600">{formatCurrency(item.amount)}</td>
                  </tr>
                ))}
              </AdminTable>
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="text-xl font-semibold text-ink">热销服务</h3>
                <p className="text-sm text-muted">用来确认最适合持续重点曝光的服务商品。</p>
              </div>
              <AdminTable headers={['服务', '价格', '销量', '状态']} hasData={data.hotProducts.length > 0} emptyText="暂无商品数据">
                {data.hotProducts.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-4 py-3 font-medium text-ink">{item.name}</td>
                    <td className="px-4 py-3 text-slate-600">{formatCurrency(item.price)}</td>
                    <td className="px-4 py-3 text-slate-600">{item.salesCount}</td>
                    <td className="px-4 py-3">
                      <Badge className={item.status ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}>
                        {item.status ? (item.isHot ? '上架·热销' : '上架') : '下架'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </AdminTable>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
