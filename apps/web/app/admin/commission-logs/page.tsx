'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { AdminTable } from '@/components/admin/admin-table';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { buildQuery, downloadCsv } from '@/lib/admin';
import { clientFetch } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useGlobalToast } from '@/store/toast-store';
import { AdminCommissionLogListResponse } from '@/types';

const initialFilters = {
  keyword: '',
  logType: '',
};

export default function AdminCommissionLogsPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState<AdminCommissionLogListResponse>({
    list: [],
    pagination: { page: 1, limit: 10, total: 0, hasMore: false },
    stats: { total: 0, amount: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useGlobalToast(message, setMessage);

  const selectedLog = useMemo(() => data.list.find((item) => item.id === selectedId) ?? null, [data.list, selectedId]);

  const loadData = async (page = 1, nextFilters = filters) => {
    try {
      setLoading(true);
      const result = await clientFetch<AdminCommissionLogListResponse>(`/admin/commission-logs?${buildQuery({ ...nextFilters, page, limit: 10 })}`);
      setData(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '激励金流水加载失败');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void loadData(1, filters);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const exportRows = () => {
    downloadCsv('激励金流水当前结果.csv', [
      ['订单号', '邀请人手机号', '消费人手机号', '激励比例', '激励金额', '原始消费金额', '流水类型', '创建时间'],
      ...data.list.map((item) => [
        item.orderNo,
        item.inviter.phone,
        item.consumer.phone,
        item.commissionRate,
        item.commissionMoney,
        item.originalConsumeMoney,
        item.logType,
        item.createAt,
      ]),
    ]);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Admin incentive logs</p>
        <div className="mt-2 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-ink">激励金流水管理</h2>
            <p className="mt-2 text-sm text-muted">支持按订单号、邀请人、消费人检索激励金流水，服务财务核对和运营排查。</p>
          </div>
          <Button variant="secondary" onClick={exportRows}>导出当前结果</Button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="rounded-3xl p-5">
              <p className="text-sm text-muted">当前筛选流水数</p>
              <p className="mt-3 text-3xl font-bold text-ink">{data.stats.total}</p>
            </Card>
            <Card className="rounded-3xl p-5">
              <p className="text-sm text-muted">当前筛选激励金金额</p>
              <p className="mt-3 text-3xl font-bold text-ink">{formatCurrency(data.stats.amount)}</p>
            </Card>
          </div>

          <Card className="rounded-3xl p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Input placeholder="搜索订单号 / 邀请人 / 消费人" value={filters.keyword} onChange={(e) => setFilters((prev) => ({ ...prev, keyword: e.target.value }))} />
              <Select value={filters.logType} onChange={(e) => setFilters((prev) => ({ ...prev, logType: e.target.value }))}>
                <option value="">全部流水类型</option>
                <option value="1">正常入账</option>
                <option value="2">退款扣减</option>
              </Select>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => void loadData(1, filters)}>搜索</Button>
                <Button className="flex-1" variant="secondary" onClick={() => { setFilters(initialFilters); void loadData(1, initialFilters); }}>重置</Button>
              </div>
            </div>
          </Card>

          <AdminTable headers={['订单号', '邀请人', '消费人', '激励金额', '比例', '流水类型']} hasData={data.list.length > 0} emptyText={loading ? '激励金流水加载中...' : '暂无流水数据'}>
            {data.list.map((item) => (
              <tr
                key={item.id}
                className={`cursor-pointer border-b border-slate-100 last:border-b-0 ${selectedId === item.id ? 'bg-brand/5' : 'hover:bg-slate-50'}`}
                onClick={() => setSelectedId(item.id)}
              >
                <td className="px-4 py-3 font-medium text-ink">{item.orderNo}</td>
                <td className="px-4 py-3 text-slate-600">{item.inviter.phone}</td>
                <td className="px-4 py-3 text-slate-600">{item.consumer.phone}</td>
                <td className="px-4 py-3 text-slate-600">{formatCurrency(item.commissionMoney)}</td>
                <td className="px-4 py-3 text-slate-600">{item.commissionRate}%</td>
                <td className="px-4 py-3 text-slate-600">{item.logType === 1 ? '正常入账' : '退款扣减'}</td>
              </tr>
            ))}
          </AdminTable>

          <AdminPagination
            page={data.pagination.page || 1}
            limit={data.pagination.limit || 10}
            total={data.pagination.total || 0}
            onPageChange={(nextPage) => void loadData(nextPage, filters)}
          />
        </div>

        <Card className="rounded-3xl p-5 xl:sticky xl:top-6 xl:self-start">
          <h3 className="text-xl font-semibold text-ink">流水详情</h3>
          <p className="mt-1 text-sm text-muted">这里用于核对邀请人、消费人、订单金额与激励金结算结果。</p>

          {selectedLog ? (
            <div className="mt-5 space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-ink">订单号</p>
                <p className="mt-1">{selectedLog.orderNo}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-ink">邀请人手机号</p>
                <p className="mt-1">{selectedLog.inviter.phone}</p>
                <p className="mt-2 font-semibold text-ink">消费人手机号</p>
                <p className="mt-1">{selectedLog.consumer.phone}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-ink">原始消费金额</p>
                <p className="mt-1">{formatCurrency(selectedLog.originalConsumeMoney)}</p>
                <p className="mt-2 font-semibold text-ink">激励比例</p>
                <p className="mt-1">{selectedLog.commissionRate}%</p>
                <p className="mt-2 font-semibold text-ink">激励金额</p>
                <p className="mt-1">{formatCurrency(selectedLog.commissionMoney)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-ink">流水类型</p>
                <p className="mt-1">{selectedLog.logType === 1 ? '正常入账' : '退款扣减'}</p>
                <p className="mt-2 font-semibold text-ink">生成时间</p>
                <p className="mt-1">{formatDate(selectedLog.createAt)}</p>
              </div>
            </div>
          ) : (
            <p className="mt-6 rounded-2xl bg-slate-50 px-4 py-6 text-sm text-muted">请先从左侧选择一条激励金流水记录。</p>
          )}
        </Card>
      </section>
    </div>
  );
}
