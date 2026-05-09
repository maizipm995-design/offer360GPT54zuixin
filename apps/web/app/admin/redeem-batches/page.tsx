'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { AdminTable } from '@/components/admin/admin-table';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { buildQuery, toDateInputValue } from '@/lib/admin';
import { clientFetch } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { useGlobalToast } from '@/store/toast-store';
import { AdminListResponse, AdminRedeemBatchItem, MemberLevel } from '@/types';

const initialFilters = {
  keyword: '',
  status: '',
  memberLevel: '',
};

const durationPlans = [
  { value: 'month', label: '月度会员卡', days: 30 },
  { value: 'quarter', label: '季度会员卡', days: 90 },
  { value: 'half-year', label: '半年会员卡', days: 180 },
  { value: 'year', label: '年度会员卡', days: 365 },
] as const;

const emptyForm = {
  batchNo: '',
  memberLevel: 'standard' as MemberLevel,
  planType: 'half-year',
  status: 'active',
  quantity: '100',
  validFrom: '',
  validUntil: '',
  remark: '',
};

const batchStatusMap: Record<string, string> = {
  active: '启用',
  inactive: '停用',
};

export default function AdminRedeemBatchesPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState<AdminListResponse<AdminRedeemBatchItem>>({
    list: [],
    pagination: { page: 1, limit: 10, total: 0, hasMore: false },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(emptyForm);

  useGlobalToast(message, setMessage);

  const page = data.pagination.page || 1;
  const selectedBatch = useMemo(() => data.list.find((item) => item.id === selectedId) ?? null, [data.list, selectedId]);
  const selectedPlan = useMemo(
    () => durationPlans.find((item) => item.value === form.planType) ?? durationPlans[2],
    [form.planType],
  );

  const loadData = async (nextPage = page, nextFilters = filters) => {
    try {
      setLoading(true);
      const result = await clientFetch<AdminListResponse<AdminRedeemBatchItem>>(
        `/admin/redeem-batches?${buildQuery({ ...nextFilters, page: nextPage, limit: 10 })}`,
      );
      setData(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '兑换码批次加载失败');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void loadData(1, filters);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fillForm = (item: AdminRedeemBatchItem) => {
    const matchedPlan = durationPlans.find((plan) => plan.days === item.grantDays) ?? durationPlans[2];
    setSelectedId(item.id);
    setForm({
      batchNo: item.batchNo,
      memberLevel: item.memberLevel,
      planType: matchedPlan.value,
      quantity: String(item.quantity),
      status: item.status,
      validFrom: toDateInputValue(item.validFrom),
      validUntil: toDateInputValue(item.validUntil),
      remark: item.remark || '',
    });
  };

  const resetForm = () => {
    setSelectedId('');
    setForm(emptyForm);
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      const payload = selectedBatch
        ? {
            status: form.status,
            validFrom: form.validFrom || undefined,
            validUntil: form.validUntil || undefined,
            remark: form.remark,
          }
        : {
            batchNo: form.batchNo || undefined,
            memberLevel: form.memberLevel,
            cardType: selectedPlan.label,
            grantDays: selectedPlan.days,
            quantity: Number(form.quantity),
            status: form.status,
            validFrom: form.validFrom || undefined,
            validUntil: form.validUntil || undefined,
            remark: form.remark || `后台批量生成 ${form.memberLevel === 'super' ? '超级会员' : '标准会员'} ${selectedPlan.label}`,
          };

      const result = selectedBatch
        ? await clientFetch<AdminRedeemBatchItem>(`/admin/redeem-batches/${selectedId}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await clientFetch<AdminRedeemBatchItem>('/admin/redeem-batches', { method: 'POST', body: JSON.stringify(payload) });

      setMessage(selectedBatch ? '兑换码批次已更新' : `兑换码批次 ${result.batchNo} 已创建`);
      fillForm(result);
      await loadData(selectedBatch ? page : 1, filters);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '兑换码批次保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Admin redeem batches</p>
        <div className="mt-2 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-ink">兑换码批次管理</h2>
            <p className="mt-2 text-sm text-muted">创建和维护标准会员 / 超级会员兑换码批次，控制时长方案、数量、生效区间与启停状态。</p>
          </div>
          <Button onClick={resetForm}>新增批次</Button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-4">
          <Card className="rounded-3xl p-4">
            <div className="grid gap-3 md:grid-cols-4">
              <Input placeholder="搜索批次号 / 卡类型 / 备注" value={filters.keyword} onChange={(e) => setFilters((prev) => ({ ...prev, keyword: e.target.value }))} />
              <Select value={filters.memberLevel} onChange={(e) => setFilters((prev) => ({ ...prev, memberLevel: e.target.value }))}>
                <option value="">全部会员等级</option>
                <option value="standard">标准会员</option>
                <option value="super">超级会员</option>
              </Select>
              <Select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
                <option value="">全部状态</option>
                <option value="active">启用中</option>
                <option value="inactive">已停用</option>
              </Select>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => void loadData(1, filters)}>搜索</Button>
                <Button className="flex-1" variant="secondary" onClick={() => { setFilters(initialFilters); resetForm(); void loadData(1, initialFilters); }}>重置</Button>
              </div>
            </div>
          </Card>

          <AdminTable
            headers={['批次号', '会员等级', '时长类型', '数量', '已用 / 未用', '状态', '创建时间']}
            hasData={data.list.length > 0}
            emptyText={loading ? '兑换码批次加载中...' : '暂无兑换码批次'}
          >
            {data.list.map((item) => (
              <tr
                key={item.id}
                className={`cursor-pointer border-b border-slate-100 last:border-b-0 ${selectedId === item.id ? 'bg-brand/5' : 'hover:bg-slate-50'}`}
                onClick={() => fillForm(item)}
              >
                <td className="px-4 py-3 font-medium text-ink">{item.batchNo}</td>
                <td className="px-4 py-3 text-slate-600">{item.memberLevelLabel}</td>
                <td className="px-4 py-3 text-slate-600">{item.cardType} / {item.grantDays} 天</td>
                <td className="px-4 py-3 text-slate-600">{item.quantity}</td>
                <td className="px-4 py-3 text-slate-600">{item.usedCount} / {item.unusedCount}</td>
                <td className="px-4 py-3 text-slate-600">{batchStatusMap[item.status] || item.status}</td>
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
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-ink">{selectedBatch ? '编辑批次' : '新建批次'}</h3>
              <p className="mt-1 text-sm text-muted">创建后会自动生成整批兑换码；编辑时仅维护状态、有效期和备注。</p>
            </div>
            {selectedBatch ? <Button variant="ghost" onClick={resetForm}>切换新增</Button> : null}
          </div>

          <div className="mt-5 space-y-4">
            <Input placeholder="批次号（留空自动生成）" value={form.batchNo} disabled={Boolean(selectedBatch)} onChange={(e) => setForm((prev) => ({ ...prev, batchNo: e.target.value.toUpperCase() }))} />
            <Select value={form.memberLevel} disabled={Boolean(selectedBatch)} onChange={(e) => setForm((prev) => ({ ...prev, memberLevel: e.target.value as MemberLevel }))}>
              <option value="standard">标准会员兑换码</option>
              <option value="super">超级会员兑换码</option>
            </Select>
            <Select value={form.planType} disabled={Boolean(selectedBatch)} onChange={(e) => setForm((prev) => ({ ...prev, planType: e.target.value }))}>
              {durationPlans.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}（{item.days} 天）
                </option>
              ))}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" placeholder="兑换码数量" value={form.quantity} disabled={Boolean(selectedBatch)} onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))} />
              <Select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
                <option value="active">启用中</option>
                <option value="inactive">已停用</option>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input type="date" value={form.validFrom} onChange={(e) => setForm((prev) => ({ ...prev, validFrom: e.target.value }))} />
              <Input type="date" value={form.validUntil} onChange={(e) => setForm((prev) => ({ ...prev, validUntil: e.target.value }))} />
            </div>
            <Textarea placeholder="批次备注" value={form.remark} onChange={(e) => setForm((prev) => ({ ...prev, remark: e.target.value }))} className="min-h-[120px]" />
          </div>

          {selectedBatch ? (
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <p>会员等级：{selectedBatch.memberLevelLabel}</p>
              <p className="mt-1">创建人：{selectedBatch.createdByAdminName || '系统'}</p>
              <p className="mt-1">已用 / 未用：{selectedBatch.usedCount} / {selectedBatch.unusedCount}</p>
              <p className="mt-1">最后更新时间：{formatDate(selectedBatch.updatedAt)}</p>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-medium text-ink">本次生成预览</p>
              <p className="mt-1">将生成 {form.memberLevel === 'super' ? '超级会员' : '标准会员'} · {selectedPlan.label} 兑换码。</p>
              <p className="mt-1">每个兑换码可为用户开通或续期 {selectedPlan.days} 天会员，数量限制 1 到 5000。</p>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <Button className="flex-1" onClick={() => void handleSubmit()} disabled={saving}>{saving ? '保存中...' : selectedBatch ? '保存批次' : '创建批次'}</Button>
          </div>
        </Card>
      </section>
    </div>
  );
}
