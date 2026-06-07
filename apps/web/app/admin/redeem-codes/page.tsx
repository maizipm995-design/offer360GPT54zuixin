'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminModal } from '@/components/admin/admin-modal';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { AdminTable } from '@/components/admin/admin-table';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { buildQuery, downloadFilePayload } from '@/lib/admin';
import { clientFetch } from '@/lib/api';
import { ADMIN_TOAST_COPY } from '@/lib/toast-copy';
import { formatDate } from '@/lib/utils';
import { useGlobalToast } from '@/store/toast-store';
import {
  AdminFileDownloadPayload,
  AdminListResponse,
  AdminRedeemBatchItem,
  AdminRedeemCodeItem,
  AdminRedeemCodeListResponse,
  AdminRedeemRecordListResponse,
  MemberLevel,
} from '@/types';

const initialCodeFilters = {
  keyword: '',
  batchId: '',
  memberLevel: '',
  status: '',
};

const initialRecordFilters = {
  keyword: '',
  batchId: '',
  memberLevel: '',
};

const durationPlans = [
  { value: 'month', label: '月度会员卡', days: 30 },
  { value: 'quarter', label: '季度会员卡', days: 90 },
  { value: 'half-year', label: '半年会员卡', days: 180 },
  { value: 'year', label: '年度会员卡', days: 365 },
] as const;

const statusLabelMap: Record<string, string> = {
  unused: '未使用',
  used: '已兑换',
  void: '已作废',
  expired: '已过期',
};

function formatDateTime(value?: string | Date | null) {
  if (!value) return '-';
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default function AdminRedeemCodesPage() {
  const [filters, setFilters] = useState(initialCodeFilters);
  const [recordFilters, setRecordFilters] = useState(initialRecordFilters);
  const [data, setData] = useState<AdminRedeemCodeListResponse>({
    list: [],
    pagination: { page: 1, limit: 10, total: 0, hasMore: false },
    stats: { total: 0, unusedCount: 0, usedCount: 0, voidCount: 0, expiredCount: 0 },
  });
  const [records, setRecords] = useState<AdminRedeemRecordListResponse>({
    list: [],
    pagination: { page: 1, limit: 8, total: 0, hasMore: false },
  });
  const [batches, setBatches] = useState<AdminRedeemBatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<'void' | 'unused'>('void');
  const [invalidReason, setInvalidReason] = useState('后台手动作废');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    memberLevel: 'standard' as MemberLevel,
    planType: 'half-year',
    quantity: '100',
  });

  useGlobalToast(message, setMessage);

  const page = data.pagination.page || 1;
  const recordPage = records.pagination.page || 1;
  const selectedCode = useMemo(() => data.list.find((item) => item.id === selectedId) ?? null, [data.list, selectedId]);
  const selectedPlan = useMemo(
    () => durationPlans.find((item) => item.value === generateForm.planType) ?? durationPlans[2],
    [generateForm.planType],
  );

  const syncActionForm = (item: AdminRedeemCodeItem | null) => {
    if (!item) {
      setNextStatus('void');
      setInvalidReason('后台手动作废');
      return;
    }
    if (item.status === 'void') {
      setNextStatus('unused');
      setInvalidReason(item.invalidReason || '后台手动作废');
    } else {
      setNextStatus('void');
      setInvalidReason(item.invalidReason || '后台手动作废');
    }
  };

  const loadCodes = async (nextPage = page, nextFilters = filters) => {
    try {
      setLoading(true);
      const result = await clientFetch<AdminRedeemCodeListResponse>(`/admin/redeem-codes?${buildQuery({ ...nextFilters, page: nextPage, limit: 10 })}`);
      setData(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.loadFailed('兑换码列表'));
    } finally {
      setLoading(false);
    }
  };

  const loadRecords = async (nextPage = recordPage, nextFilters = recordFilters) => {
    try {
      setRecordsLoading(true);
      const result = await clientFetch<AdminRedeemRecordListResponse>(`/admin/redeem-records?${buildQuery({ ...nextFilters, page: nextPage, limit: 8 })}`);
      setRecords(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.loadFailed('兑换记录'));
    } finally {
      setRecordsLoading(false);
    }
  };

  const loadBatchOptions = async () => {
    try {
      const result = await clientFetch<AdminListResponse<AdminRedeemBatchItem>>('/admin/redeem-batches?page=1&limit=100');
      setBatches(result.list);
    } catch {
      // ignore option loading failure
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void Promise.all([loadCodes(1, filters), loadRecords(1, recordFilters), loadBatchOptions()]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = (item: AdminRedeemCodeItem) => {
    setSelectedId(item.id);
    syncActionForm(item);
  };

  const openDetailModal = (item: AdminRedeemCodeItem) => {
    handleSelect(item);
    setDetailModalOpen(true);
  };

  const closeDetailModal = () => {
    setDetailModalOpen(false);
  };

  const handleResetCodes = async () => {
    setFilters(initialCodeFilters);
    setSelectedId('');
    syncActionForm(null);
    closeDetailModal();
    await loadCodes(1, initialCodeFilters);
  };

  const handleResetRecords = async () => {
    setRecordFilters(initialRecordFilters);
    await loadRecords(1, initialRecordFilters);
  };

  const canOperate = Boolean(selectedCode && (selectedCode.status === 'unused' || selectedCode.status === 'void'));

  const handleSubmit = async () => {
    if (!selectedCode) return;
    if (!canOperate) {
      setMessage('当前状态下的兑换码暂不支持操作');
      return;
    }

    try {
      setSaving(true);
      const payload = nextStatus === 'void' ? { status: 'void', invalidReason } : { status: 'unused' };
      const result = await clientFetch<AdminRedeemCodeItem>(`/admin/redeem-codes/${selectedCode.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setMessage(nextStatus === 'void' ? ADMIN_TOAST_COPY.disabled('兑换码') : ADMIN_TOAST_COPY.enabled('兑换码'));
      handleSelect(result);
      await Promise.all([loadCodes(page, filters), loadRecords(recordPage, recordFilters)]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.operationFailed('兑换码'));
    } finally {
      setSaving(false);
    }
  };

  const handleExportAll = async () => {
    try {
      setExporting(true);
      const payload = await clientFetch<AdminFileDownloadPayload>(`/admin/redeem-codes/export?${buildQuery(filters)}`);
      downloadFilePayload(payload);
      setMessage(ADMIN_TOAST_COPY.exportDone('兑换码数据'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.exportFailed('兑换码'));
    } finally {
      setExporting(false);
    }
  };

  const handleGenerate = async () => {
    const quantity = Number(generateForm.quantity || 100);
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 5000) {
      setMessage('生成数量需为 1 到 5000 的整数');
      return;
    }

    try {
      setGenerating(true);
      const levelLabel = generateForm.memberLevel === 'super' ? '超级会员' : '标准会员';
      const result = await clientFetch<AdminRedeemBatchItem>('/admin/redeem-batches', {
        method: 'POST',
        body: JSON.stringify({
          memberLevel: generateForm.memberLevel,
          cardType: selectedPlan.label,
          grantDays: selectedPlan.days,
          quantity,
          status: 'active',
          remark: `后台批量生成 ${levelLabel} ${selectedPlan.label} 兑换码 ${quantity} 个`,
        }),
      });
      setShowGenerateModal(false);
      setGenerateForm({ memberLevel: generateForm.memberLevel, planType: selectedPlan.value, quantity: '100' });
      setMessage(`已生成批次 ${result.batchNo}，共 ${result.quantity} 个${result.memberLevelLabel}${result.cardType}`);
      await Promise.all([loadCodes(1, filters), loadBatchOptions()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.operationFailed('兑换码生成'));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Admin membership redeem center</p>
          <div className="mt-2 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-3xl font-bold text-ink">会员兑换码管理</h2>
              <p className="mt-2 max-w-3xl text-sm text-muted">集中完成全部兑换码查看、兑换记录追溯、批量生成与全量导出；现已支持标准会员 / 超级会员两类兑换码闭环管理。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void handleExportAll()} disabled={exporting}>
                {exporting ? '导出中...' : '批量导出全部兑换码'}
              </Button>
              <Button onClick={() => setShowGenerateModal(true)}>生成兑换码</Button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-3xl p-5"><p className="text-sm text-muted">全部兑换码</p><p className="mt-3 text-3xl font-bold text-ink">{data.stats.total}</p></Card>
          <Card className="rounded-3xl p-5"><p className="text-sm text-muted">未兑换</p><p className="mt-3 text-3xl font-bold text-emerald-600">{data.stats.unusedCount}</p></Card>
          <Card className="rounded-3xl p-5"><p className="text-sm text-muted">已兑换</p><p className="mt-3 text-3xl font-bold text-ink">{data.stats.usedCount}</p></Card>
          <Card className="rounded-3xl p-5"><p className="text-sm text-muted">兑换异常</p><p className="mt-3 text-3xl font-bold text-rose-600">{data.stats.voidCount + data.stats.expiredCount}</p></Card>
        </section>

        <section className="space-y-4">
          <div>
            <h3 className="text-xl font-semibold text-ink">全部兑换码列表</h3>
            <p className="mt-1 text-sm text-muted">支持按会员等级、批次、状态查询兑换码，可对未兑换或已作废兑换码执行单条运营操作。</p>
          </div>

          <Card className="rounded-3xl p-4">
            <div className="grid gap-3 md:grid-cols-5">
              <Input placeholder="搜索兑换码 / 批次号" value={filters.keyword} onChange={(e) => setFilters((prev) => ({ ...prev, keyword: e.target.value }))} />
              <Select value={filters.batchId} onChange={(e) => setFilters((prev) => ({ ...prev, batchId: e.target.value }))}>
                <option value="">全部批次</option>
                {batches.map((item) => <option key={item.id} value={item.id}>{item.batchNo}</option>)}
              </Select>
              <Select value={filters.memberLevel} onChange={(e) => setFilters((prev) => ({ ...prev, memberLevel: e.target.value }))}>
                <option value="">全部会员等级</option>
                <option value="standard">标准会员</option>
                <option value="super">超级会员</option>
              </Select>
              <Select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
                <option value="">全部状态</option>
                <option value="unused">未使用</option>
                <option value="used">已兑换</option>
                <option value="void">已作废</option>
                <option value="expired">已过期</option>
              </Select>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => void loadCodes(1, filters)}>搜索</Button>
                <Button className="flex-1" variant="secondary" onClick={() => void handleResetCodes()}>重置</Button>
              </div>
            </div>
          </Card>

          <div className="space-y-4">
            <AdminTable
              headers={['兑换码', '批次号', '会员等级', '时长类型', '状态', '使用用户', '有效期', '更新时间']}
              hasData={data.list.length > 0}
              emptyText={loading ? '兑换码列表加载中...' : '暂无兑换码数据'}
            >
              {data.list.map((item) => (
                <tr
                  key={item.id}
                  className={`cursor-pointer border-b border-slate-100 last:border-b-0 ${selectedId === item.id ? 'bg-brand/5' : 'hover:bg-slate-50'}`}
                  onClick={() => openDetailModal(item)}
                >
                  <td className="px-4 py-3 font-medium text-ink">{item.code}</td>
                  <td className="px-4 py-3 text-slate-600">{item.batchNo}</td>
                  <td className="px-4 py-3 text-slate-600">{item.memberLevelLabel}</td>
                  <td className="px-4 py-3 text-slate-600">{item.cardType} / {item.grantDays} 天</td>
                  <td className="px-4 py-3 text-slate-600">{statusLabelMap[item.status] || item.status}</td>
                  <td className="px-4 py-3 text-slate-600">{item.usedByUserPhone || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(item.validUntil)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDateTime(item.updatedAt)}</td>
                </tr>
              ))}
            </AdminTable>

            <AdminPagination
              page={data.pagination.page || 1}
              limit={data.pagination.limit || 10}
              total={data.pagination.total || 0}
              onPageChange={(nextPage) => void loadCodes(nextPage, filters)}
            />
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-ink">近期兑换记录</h3>
              <p className="mt-1 text-sm text-muted">单独展示用户兑换使用日志，便于客服、运营追溯兑换来源、会员等级和兑换账号。</p>
            </div>
            <p className="text-sm text-muted">当前共 {records.pagination.total || 0} 条记录</p>
          </div>

          <Card className="rounded-3xl p-4">
            <div className="grid gap-3 md:grid-cols-4">
              <Input placeholder="搜索兑换码 / 批次号 / 用户手机号" value={recordFilters.keyword} onChange={(e) => setRecordFilters((prev) => ({ ...prev, keyword: e.target.value }))} />
              <Select value={recordFilters.batchId} onChange={(e) => setRecordFilters((prev) => ({ ...prev, batchId: e.target.value }))}>
                <option value="">全部批次</option>
                {batches.map((item) => <option key={item.id} value={item.id}>{item.batchNo}</option>)}
              </Select>
              <Select value={recordFilters.memberLevel} onChange={(e) => setRecordFilters((prev) => ({ ...prev, memberLevel: e.target.value }))}>
                <option value="">全部会员等级</option>
                <option value="standard">标准会员</option>
                <option value="super">超级会员</option>
              </Select>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => void loadRecords(1, recordFilters)}>搜索</Button>
                <Button className="flex-1" variant="secondary" onClick={() => void handleResetRecords()}>重置</Button>
              </div>
            </div>
          </Card>

          <AdminTable
            headers={['兑换时间', '兑换码', '批次号', '会员等级', '时长类型', '用户手机号', '兑换备注']}
            hasData={records.list.length > 0}
            emptyText={recordsLoading ? '兑换记录加载中...' : '暂无兑换记录'}
          >
            {records.list.map((item) => (
              <tr key={item.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">{formatDateTime(item.usedAt)}</td>
                <td className="px-4 py-3 font-medium text-ink">{item.code}</td>
                <td className="px-4 py-3 text-slate-600">{item.batchNo}</td>
                <td className="px-4 py-3 text-slate-600">{item.memberLevelLabel}</td>
                <td className="px-4 py-3 text-slate-600">{item.cardType} / {item.grantDays} 天</td>
                <td className="px-4 py-3 text-slate-600">{item.userPhone || '-'}</td>
                <td className="px-4 py-3 text-slate-600">{item.remark || '-'}</td>
              </tr>
            ))}
          </AdminTable>

          <AdminPagination
            page={records.pagination.page || 1}
            limit={records.pagination.limit || 8}
            total={records.pagination.total || 0}
            onPageChange={(nextPage) => void loadRecords(nextPage, recordFilters)}
          />
        </section>
      </div>

      <AdminModal
        open={detailModalOpen}
        title="兑换码详情"
        description="已兑换和已过期兑换码仅支持查看；未使用码可作废，已作废码可恢复。"
        onClose={closeDetailModal}
      >
        {selectedCode ? (
          <div className="space-y-4 text-sm text-slate-600">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-ink">兑换码</p>
                <p className="mt-1 break-all">{selectedCode.code}</p>
                <p className="mt-3 font-semibold text-ink">当前状态</p>
                <p className="mt-1">{statusLabelMap[selectedCode.status] || selectedCode.status}</p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-ink">所属批次</p>
                <p className="mt-1">{selectedCode.batchNo}</p>
                <p className="mt-3 font-semibold text-ink">会员等级 / 时长类型</p>
                <p className="mt-1">{selectedCode.memberLevelLabel} / {selectedCode.cardType} / {selectedCode.grantDays} 天</p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-ink">使用信息</p>
                <p className="mt-1">使用用户：{selectedCode.usedByUserPhone || '暂无'}</p>
                <p className="mt-1">使用时间：{formatDateTime(selectedCode.usedAt)}</p>
                <p className="mt-1">兑换码失效时间：{formatDate(selectedCode.validUntil)}</p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-ink">作废与备注</p>
                <p className="mt-1">作废时间：{formatDateTime(selectedCode.invalidatedAt)}</p>
                <p className="mt-1">作废管理员：{selectedCode.invalidatedByAdminName || '暂无'}</p>
                <p className="mt-1">作废原因：{selectedCode.invalidReason || '暂无'}</p>
                <p className="mt-3 font-semibold text-ink">最近兑换备注</p>
                <p className="mt-1">{selectedCode.latestRemark || '暂无'}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="font-semibold text-ink">手动操作</p>
              {canOperate ? (
                <div className="mt-3 grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_200px] lg:items-start">
                  <Select value={nextStatus} onChange={(e) => setNextStatus(e.target.value as 'void' | 'unused')}>
                    {selectedCode.status === 'void' ? <option value="unused">恢复为未使用</option> : null}
                    {selectedCode.status === 'unused' ? <option value="void">作废兑换码</option> : null}
                  </Select>
                  <Textarea className="min-h-[100px]" placeholder="作废原因" value={invalidReason} disabled={nextStatus === 'unused'} onChange={(e) => setInvalidReason(e.target.value)} />
                  <Button onClick={() => void handleSubmit()} disabled={saving}>
                    {saving ? '提交中...' : nextStatus === 'void' ? '确认作废' : '恢复为未使用'}
                  </Button>
                </div>
              ) : (
                <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-muted">当前状态为 {statusLabelMap[selectedCode.status] || selectedCode.status}，不支持手动变更。</p>
              )}
            </div>
          </div>
        ) : (
          <p className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-muted">请先从列表选择一条兑换码记录，再查看详情或执行作废 / 恢复操作。</p>
        )}
      </AdminModal>

      {showGenerateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Batch generate</p>
                <h3 className="mt-2 text-2xl font-bold text-ink">生成兑换码</h3>
                <p className="mt-2 text-sm text-muted">选择会员等级、时长类型和数量后，系统会自动创建新批次并一次性生成对应兑换码。</p>
              </div>
              <Button variant="ghost" onClick={() => setShowGenerateModal(false)} disabled={generating}>关闭</Button>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">兑换码会员等级</span>
                <Select value={generateForm.memberLevel} onChange={(e) => setGenerateForm((prev) => ({ ...prev, memberLevel: e.target.value as MemberLevel }))}>
                  <option value="standard">标准会员兑换码</option>
                  <option value="super">超级会员兑换码</option>
                </Select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">兑换码时长类型</span>
                <Select value={generateForm.planType} onChange={(e) => setGenerateForm((prev) => ({ ...prev, planType: e.target.value }))}>
                  {durationPlans.map((item) => <option key={item.value} value={item.value}>{item.label}（{item.days} 天）</option>)}
                </Select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">生成数量</span>
                <Input type="number" min={1} max={5000} value={generateForm.quantity} onChange={(e) => setGenerateForm((prev) => ({ ...prev, quantity: e.target.value }))} />
              </label>

              <div className="grid grid-cols-3 gap-2">
                {[100, 300, 500].map((count) => (
                  <Button key={count} variant="secondary" onClick={() => setGenerateForm((prev) => ({ ...prev, quantity: String(count) }))}>
                    {count} 个
                  </Button>
                ))}
              </div>

              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-semibold text-ink">本次生成预览</p>
                <p className="mt-2">将生成 <span className="font-semibold text-ink">{generateForm.quantity || '0'}</span> 个 <span className="font-semibold text-ink">{generateForm.memberLevel === 'super' ? '超级会员' : '标准会员'} {selectedPlan.label}</span> 兑换码。</p>
                <p className="mt-1">每个兑换码可为用户开通或续期 <span className="font-semibold text-ink">{selectedPlan.days}</span> 天会员。</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowGenerateModal(false)} disabled={generating}>取消</Button>
              <Button onClick={() => void handleGenerate()} disabled={generating}>{generating ? '生成中...' : '确认生成'}</Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
