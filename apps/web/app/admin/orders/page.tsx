'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { AdminTable } from '@/components/admin/admin-table';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { buildQuery, downloadCsv } from '@/lib/admin';
import { clientFetch } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useGlobalToast } from '@/store/toast-store';
import { AdminOrderItem, AdminOrderListResponse } from '@/types';

const initialFilters = {
  keyword: '',
  payStatus: '',
};

type AdminRecentOrderReconcileResult = {
  scanned: number;
  changed: number;
  limit: number;
  lookbackHours: number;
  list: Array<{
    id: string;
    orderNo: string;
    payStatus: string;
    refundReason?: string | null;
    updatedAt: string;
  }>;
};

function getPayStatusLabel(payStatus: string) {
  if (payStatus === 'paid') return '已支付';
  if (payStatus === 'refund_pending') return '退款处理中';
  if (payStatus === 'refunded') return '已退款';
  if (payStatus === 'closed') return '已关闭';
  return '待支付';
}

function getPayStatusClassName(payStatus: string) {
  if (payStatus === 'paid') return 'text-brand';
  if (payStatus === 'refund_pending') return 'text-amber-600';
  if (payStatus === 'refunded' || payStatus === 'closed') return 'text-slate-500';
  return 'text-red-500';
}

export default function AdminOrdersPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState<AdminOrderListResponse>({
    list: [],
    pagination: { page: 1, limit: 10, total: 0, hasMore: false },
    stats: { total: 0, amount: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [singleReconciling, setSingleReconciling] = useState(false);
  const [batchReconciling, setBatchReconciling] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [payStatusDraft, setPayStatusDraft] = useState('paid');
  const [refundReasonDraft, setRefundReasonDraft] = useState('');
  const [remarkDraft, setRemarkDraft] = useState('');

  useGlobalToast(message, setMessage);

  const selectedOrder = useMemo(() => data.list.find((item) => item.id === selectedId) ?? null, [data.list, selectedId]);
  const statusActionDisabled = selectedOrder?.payStatus === 'refund_pending';

  const loadData = async (page = 1, nextFilters = filters) => {
    try {
      setLoading(true);
      const result = await clientFetch<AdminOrderListResponse>(`/admin/orders?${buildQuery({ ...nextFilters, page, limit: 10 })}`);
      setData(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '订单数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void loadData(1, filters);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedOrder) {
      setPayStatusDraft('paid');
      setRefundReasonDraft('');
      setRemarkDraft('');
      return;
    }
    setPayStatusDraft(['paid', 'closed', 'refunded'].includes(selectedOrder.payStatus) ? selectedOrder.payStatus : 'paid');
    setRefundReasonDraft(selectedOrder.refundReason || '');
    setRemarkDraft(selectedOrder.remark || '');
  }, [selectedOrder]);

  const exportRows = () => {
    downloadCsv('服务订单当前结果.csv', [
      ['订单号', '用户手机号', '商品名称', '金额', '支付状态', '退款原因', '下单时间', '支付时间'],
      ...data.list.map((item) => [item.orderNo, item.user.phone, item.product.name, item.amount, getPayStatusLabel(item.payStatus), item.refundReason || '', item.createdAt, item.payTime || '']),
    ]);
  };

  const handleUpdateStatus = async () => {
    if (!selectedOrder) return;
    if (selectedOrder.payStatus === 'refund_pending') {
      setMessage('退款处理中订单请先同步微信状态，再决定是否继续人工处理。');
      return;
    }
    try {
      setSaving(true);
      const result = await clientFetch<AdminOrderItem>(`/admin/orders/${selectedOrder.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          payStatus: payStatusDraft,
          refundReason: refundReasonDraft,
          remark: remarkDraft,
        }),
      });
      setMessage(`订单已处理为${getPayStatusLabel(result.payStatus)}`);
      await loadData(data.pagination.page, filters);
      setSelectedId(result.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '订单状态更新失败');
    } finally {
      setSaving(false);
    }
  };

  const handleReconcileOrder = async () => {
    if (!selectedOrder) return;
    try {
      setSingleReconciling(true);
      const result = await clientFetch<AdminOrderItem>(`/admin/orders/${selectedOrder.id}/reconcile`, {
        method: 'POST',
      });
      setMessage(`已同步微信状态，当前订单为${getPayStatusLabel(result.payStatus)}`);
      await loadData(data.pagination.page, filters);
      setSelectedId(result.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '同步微信状态失败');
    } finally {
      setSingleReconciling(false);
    }
  };

  const handleBatchReconcile = async () => {
    try {
      setBatchReconciling(true);
      const result = await clientFetch<AdminRecentOrderReconcileResult>('/admin/orders/reconcile', {
        method: 'POST',
        body: JSON.stringify({
          limit: 20,
          lookbackHours: 48,
        }),
      });
      setMessage(`已补偿最近 ${result.scanned} 笔异常订单，其中 ${result.changed} 笔状态发生变化。`);
      await loadData(data.pagination.page, filters);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '批量补偿失败');
    } finally {
      setBatchReconciling(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Admin orders</p>
        <div className="mt-2 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-ink">服务订单管理</h2>
            <p className="mt-2 text-sm text-muted">查看订单号、支付状态、金额与关联用户信息，并按真实支付语义执行人工确认支付、关闭订单、退款与微信状态补偿。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={handleBatchReconcile} disabled={batchReconciling}>
              {batchReconciling ? '补偿中...' : '补偿最近异常订单'}
            </Button>
            <Button variant="secondary" onClick={exportRows}>导出当前结果</Button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="rounded-3xl p-5">
              <p className="text-sm text-muted">当前筛选订单数</p>
              <p className="mt-3 text-3xl font-bold text-ink">{data.stats.total}</p>
            </Card>
            <Card className="rounded-3xl p-5">
              <p className="text-sm text-muted">当前筛选订单金额</p>
              <p className="mt-3 text-3xl font-bold text-ink">{formatCurrency(data.stats.amount)}</p>
            </Card>
          </div>

          <Card className="rounded-3xl p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Input placeholder="搜索订单号 / 用户手机号 / 商品名" value={filters.keyword} onChange={(e) => setFilters((prev) => ({ ...prev, keyword: e.target.value }))} />
              <Select value={filters.payStatus} onChange={(e) => setFilters((prev) => ({ ...prev, payStatus: e.target.value }))}>
                <option value="">全部支付状态</option>
                <option value="unpaid">待支付</option>
                <option value="paid">已支付</option>
                <option value="refund_pending">退款处理中</option>
                <option value="closed">已关闭</option>
                <option value="refunded">已退款</option>
              </Select>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => void loadData(1, filters)}>搜索</Button>
                <Button className="flex-1" variant="secondary" onClick={() => { setFilters(initialFilters); void loadData(1, initialFilters); }}>重置</Button>
              </div>
            </div>
          </Card>

          <AdminTable headers={['订单号', '用户', '商品', '金额', '状态', '退款原因', '创建时间']} hasData={data.list.length > 0} emptyText={loading ? '订单加载中...' : '暂无订单数据'}>
            {data.list.map((item) => (
              <tr
                key={item.id}
                className={`cursor-pointer border-b border-slate-100 last:border-b-0 ${selectedId === item.id ? 'bg-brand/5' : 'hover:bg-slate-50'}`}
                onClick={() => setSelectedId(item.id)}
              >
                <td className="px-4 py-3 font-medium text-ink">{item.orderNo}</td>
                <td className="px-4 py-3 text-slate-600">{item.user.phone}</td>
                <td className="px-4 py-3 text-slate-600">{item.product.name}</td>
                <td className="px-4 py-3 text-slate-600">{formatCurrency(item.amount)}</td>
                <td className={`px-4 py-3 font-medium ${getPayStatusClassName(item.payStatus)}`}>{getPayStatusLabel(item.payStatus)}</td>
                <td className="px-4 py-3 text-slate-600">{item.refundReason || '-'}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(item.createdAt)}</td>
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
          <h3 className="text-xl font-semibold text-ink">订单详情与状态处理</h3>
          <p className="mt-1 text-sm text-muted">选中左侧订单后，可执行人工确认支付、关闭订单、发起退款，或先和微信侧重新对账补偿。</p>

          {selectedOrder ? (
            <div className="mt-5 space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-ink">订单号</p>
                <p className="mt-1">{selectedOrder.orderNo}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-ink">支付状态</p>
                <p className={`mt-1 font-semibold ${getPayStatusClassName(selectedOrder.payStatus)}`}>{getPayStatusLabel(selectedOrder.payStatus)}</p>
                <p className="mt-2 font-semibold text-ink">退款时间</p>
                <p className="mt-1">{formatDate(selectedOrder.refundAt)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-ink">订单金额</p>
                <p className="mt-1">{formatCurrency(selectedOrder.amount)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-ink">用户手机号</p>
                <p className="mt-1">{selectedOrder.user.phone}</p>
                <p className="mt-2 font-semibold text-ink">用户邀请码</p>
                <p className="mt-1">{selectedOrder.user.myInviteCode}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-ink">商品名称</p>
                <p className="mt-1">{selectedOrder.product.name}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-ink">下单时间</p>
                <p className="mt-1">{formatDate(selectedOrder.createdAt)}</p>
                <p className="mt-2 font-semibold text-ink">支付时间</p>
                <p className="mt-1">{formatDate(selectedOrder.payTime)}</p>
              </div>

              {selectedOrder.payStatus === 'refund_pending' ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-700">
                  微信已受理退款申请，但本地仍在等待最终异步结果。建议先点击下方“同步微信状态”，再决定是否继续人工处理。
                </div>
              ) : null}

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-ink">状态处理</p>
                <div className="mt-3 space-y-3">
                  <Select value={payStatusDraft} onChange={(e) => setPayStatusDraft(e.target.value)}>
                    {selectedOrder.payStatus === 'refund_pending' ? <option value="refund_pending">退款处理中（仅同步）</option> : null}
                    <option value="paid">已支付</option>
                    <option value="closed">已关闭</option>
                    <option value="refunded">已退款</option>
                  </Select>
                  <Textarea placeholder="退款原因（仅退款时建议填写）" value={refundReasonDraft} onChange={(e) => setRefundReasonDraft(e.target.value)} className="min-h-[96px]" />
                  <Textarea placeholder="处理备注（人工确认支付 / 关闭订单 / 退款说明）" value={remarkDraft} onChange={(e) => setRemarkDraft(e.target.value)} className="min-h-[96px]" />
                  <div className="flex gap-3">
                    <Button className="flex-1" variant="secondary" onClick={() => void handleReconcileOrder()} disabled={singleReconciling}>
                      {singleReconciling ? '同步中...' : '同步微信状态'}
                    </Button>
                    <Button className="flex-1" onClick={() => void handleUpdateStatus()} disabled={saving || statusActionDisabled}>
                      {saving ? '处理中...' : '执行订单处理'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-6 rounded-2xl bg-slate-50 px-4 py-6 text-sm text-muted">请先从左侧选择一条订单记录。</p>
          )}
        </Card>
      </section>
    </div>
  );
}
