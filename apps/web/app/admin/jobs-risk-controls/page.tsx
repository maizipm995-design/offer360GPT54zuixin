'use client';

import { useEffect, useState } from 'react';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { AdminTable } from '@/components/admin/admin-table';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { buildQuery } from '@/lib/admin';
import { clientFetch } from '@/lib/api';
import { ADMIN_TOAST_COPY } from '@/lib/toast-copy';
import { formatDate } from '@/lib/utils';
import { useGlobalToast } from '@/store/toast-store';
import {
  AdminJobsRiskConfig,
  AdminJobsRiskControlItem,
  AdminJobsRiskControlDetailResponse,
  AdminJobsRiskControlResponse,
  AdminJobsRiskFreezeItem,
  AdminJobsRiskLogItem,
} from '@/types';

const initialFilters = {
  keyword: '',
  action: '',
  requestStatus: '',
  riskHit: '',
  limitHit: '',
  reviewStatus: '',
  scope: '',
  riskLevel: '',
};

const initialDetailState: AdminJobsRiskControlDetailResponse | null = null;

function formatTtl(ttlSeconds: number) {
  if (ttlSeconds <= 0) return '即将失效';
  const hours = Math.floor(ttlSeconds / 3600);
  const minutes = Math.floor((ttlSeconds % 3600) / 60);
  const seconds = ttlSeconds % 60;
  if (hours > 0) return `${hours}小时${minutes}分钟`;
  if (minutes > 0) return `${minutes}分钟${seconds}秒`;
  return `${seconds}秒`;
}

function resolveFreezeTarget(log: AdminJobsRiskLogItem | null) {
  if (!log) {
    return { scope: 'user', identifier: '' };
  }
  if (log.userId) return { scope: 'user', identifier: log.userId };
  if (log.deviceId) return { scope: 'device', identifier: log.deviceId };
  if (log.ip) return { scope: 'ip', identifier: log.ip };
  return { scope: 'user', identifier: '' };
}

function resolveRiskTone(level?: number) {
  if (level === 4) return 'text-red-700 bg-red-50';
  if (level === 3) return 'text-rose-700 bg-rose-50';
  if (level === 2) return 'text-amber-700 bg-amber-50';
  return 'text-sky-700 bg-sky-50';
}

function resolveControlLabel(controlType?: 'cooldown' | 'restrict' | 'freeze') {
  if (controlType === 'freeze') return '冻结';
  if (controlType === 'restrict') return '限制查看';
  return '冷却观察';
}

function readConfigNumber(config: AdminJobsRiskConfig, path: string[]) {
  return path.reduce<unknown>((current, key) => (
    current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined
  ), config);
}

function updateConfigNumber(config: AdminJobsRiskConfig, path: string[], value: number): AdminJobsRiskConfig {
  const [head, ...rest] = path;
  if (!head) {
    return config;
  }
  const current = config as unknown as Record<string, unknown>;
  if (!rest.length) {
    return {
      ...config,
      [head]: value,
    } as AdminJobsRiskConfig;
  }
  return {
    ...config,
    [head]: updateConfigNumber(current[head] as AdminJobsRiskConfig, rest, value),
  } as AdminJobsRiskConfig;
}

function ConfigNumberField(props: {
  config: AdminJobsRiskConfig;
  label: string;
  path: string[];
  onChange: (path: string[], value: number) => void;
  step?: string;
  min?: string;
}) {
  const value = readConfigNumber(props.config, props.path);
  return (
    <label className="space-y-1 text-sm text-slate-600">
      <span>{props.label}</span>
      <Input
        type="number"
        min={props.min ?? '1'}
        step={props.step ?? '1'}
        value={typeof value === 'number' ? String(value) : ''}
        onChange={(event) => props.onChange(props.path, Number(event.target.value) || 0)}
      />
    </label>
  );
}

export default function AdminJobsRiskControlsPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState<AdminJobsRiskControlResponse>({
    summary: {
      totalLast24h: 0,
      deniedLast24h: 0,
      limitLast24h: 0,
      riskLast24h: 0,
      activeFreezeCount: 0,
      activeControlCount: 0,
      pendingReviewCount: 0,
      processingReviewCount: 0,
    },
    activeFreezes: [],
    activeControls: [],
    list: [],
    pagination: { page: 1, limit: 10, total: 0, hasMore: false },
  });
  const [detail, setDetail] = useState<AdminJobsRiskControlDetailResponse | null>(initialDetailState);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
  const [selectedControlKeys, setSelectedControlKeys] = useState<string[]>([]);
  const [unfreezingKey, setUnfreezingKey] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [batchReviewSubmitting, setBatchReviewSubmitting] = useState(false);
  const [batchUnfreezeSubmitting, setBatchUnfreezeSubmitting] = useState(false);
  const [freezeSubmitting, setFreezeSubmitting] = useState(false);
  const [riskConfig, setRiskConfig] = useState<AdminJobsRiskConfig | null>(null);
  const [riskConfigLoading, setRiskConfigLoading] = useState(true);
  const [riskConfigSubmitting, setRiskConfigSubmitting] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    reviewStatus: 'processing',
    reviewConclusion: '',
    reviewNote: '',
  });
  const [freezeForm, setFreezeForm] = useState({
    scope: 'user',
    identifier: '',
    reason: '',
    durationSeconds: '3600',
  });

  useGlobalToast(message, setMessage);

  const loadDetail = async (id: string) => {
    try {
      setDetailLoading(true);
      const result = await clientFetch<AdminJobsRiskControlDetailResponse>(`/admin/jobs-risk-controls/${id}`);
      setDetail(result);
      setReviewForm({
        reviewStatus: result.item.reviewStatus === 'not_required' ? 'processing' : result.item.reviewStatus,
        reviewConclusion: result.item.reviewConclusion || '',
        reviewNote: result.item.reviewNote || '',
      });
      const target = resolveFreezeTarget(result.item);
      setFreezeForm((prev) => ({
        scope: target.scope,
        identifier: target.identifier,
        reason: prev.reason,
        durationSeconds: prev.durationSeconds,
      }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '加载风控详情失败');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const loadData = async (page = 1, nextFilters = filters) => {
    try {
      setLoading(true);
      const result = await clientFetch<AdminJobsRiskControlResponse>(`/admin/jobs-risk-controls?${buildQuery({ ...nextFilters, page, limit: 10 })}`);
      setData(result);
      setSelectedLogIds((prev) => prev.filter((id) => result.list.some((item) => item.id === id)));
      setSelectedControlKeys((prev) => prev.filter((key) => result.activeControls.some((item) => item.key === key)));
      const nextSelectedId = selectedId && result.list.some((item) => item.id === selectedId)
        ? selectedId
        : result.list[0]?.id || '';
      setSelectedId(nextSelectedId);
      if (nextSelectedId) {
        await loadDetail(nextSelectedId);
      } else {
        setDetail(null);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.loadFailed('招聘风控工作台'));
    } finally {
      setLoading(false);
    }
  };

  const toggleLogSelection = (id: string) => {
    setSelectedLogIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleControlSelection = (key: string) => {
    setSelectedControlKeys((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  const handleRiskConfigChange = (path: string[], value: number) => {
    setRiskConfig((prev) => (prev ? updateConfigNumber(prev, path, value) : prev));
  };

  const handleRiskConfigSave = async () => {
    if (!riskConfig) {
      setMessage('风控参数尚未加载完成');
      return;
    }
    try {
      setRiskConfigSubmitting(true);
      const result = await clientFetch<AdminJobsRiskConfig>('/admin/jobs-risk-config', {
        method: 'PATCH',
        body: JSON.stringify({ config: riskConfig }),
      });
      setRiskConfig(result);
      setMessage('风控参数已保存，新的放宽规则已生效');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存风控参数失败');
    } finally {
      setRiskConfigSubmitting(false);
    }
  };

  const handleBatchReviewSubmit = async () => {
    if (!selectedLogIds.length) {
      setMessage('请先选择至少一条风控记录');
      return;
    }
    try {
      setBatchReviewSubmitting(true);
      await clientFetch('/admin/jobs-risk-controls/batch-review', {
        method: 'POST',
        body: JSON.stringify({
          logIds: selectedLogIds,
          ...reviewForm,
        }),
      });
      setMessage(`已批量保存 ${selectedLogIds.length} 条审核结果`);
      setSelectedLogIds([]);
      await loadData(data.pagination.page || 1, filters);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '批量保存审核结果失败');
    } finally {
      setBatchReviewSubmitting(false);
    }
  };

  const handleBatchUnfreeze = async () => {
    const items = data.activeControls.filter((item) => selectedControlKeys.includes(item.key));
    if (!items.length) {
      setMessage('请先选择至少一个处置对象');
      return;
    }
    try {
      setBatchUnfreezeSubmitting(true);
      await clientFetch('/admin/jobs-risk-controls/batch-unfreeze', {
        method: 'POST',
        body: JSON.stringify({
          items: items.map((item) => ({
            scope: item.scope,
            identifier: item.identifier,
            controlType: item.controlType,
          })),
        }),
      });
      setMessage(`已批量解除 ${items.length} 个处置对象`);
      setSelectedControlKeys([]);
      await loadData(data.pagination.page || 1, filters);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '批量解除处置失败');
    } finally {
      setBatchUnfreezeSubmitting(false);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        const result = await clientFetch<AdminJobsRiskControlResponse>(`/admin/jobs-risk-controls?${buildQuery({ ...initialFilters, page: 1, limit: 10 })}`);
        setData(result);
        setSelectedId(result.list[0]?.id || '');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.loadFailed('招聘风控工作台'));
      } finally {
        setLoading(false);
      }

      try {
        setRiskConfigLoading(true);
        const result = await clientFetch<AdminJobsRiskConfig>('/admin/jobs-risk-config');
        setRiskConfig(result);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '加载风控参数失败');
      } finally {
        setRiskConfigLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedId);
  }, [selectedId]);

  const handleUnfreeze = async (item: AdminJobsRiskFreezeItem | AdminJobsRiskControlItem) => {
    try {
      setUnfreezingKey(item.key);
      await clientFetch('/admin/jobs-risk-controls/unfreeze', {
        method: 'POST',
        body: JSON.stringify({ scope: item.scope, identifier: item.identifier, controlType: item.controlType || 'freeze' }),
      });
      setMessage('处置状态已解除');
      await loadData(data.pagination.page || 1, filters);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '解除处置失败');
    } finally {
      setUnfreezingKey('');
    }
  };

  const handleReviewSubmit = async () => {
    if (!selectedId) return;
    try {
      setReviewSubmitting(true);
      await clientFetch(`/admin/jobs-risk-controls/${selectedId}/review`, {
        method: 'POST',
        body: JSON.stringify(reviewForm),
      });
      setMessage('人工审核结果已保存');
      await loadData(data.pagination.page || 1, filters);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存审核结果失败');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleFreezeSubmit = async () => {
    if (!selectedId || !freezeForm.identifier.trim() || !freezeForm.reason.trim()) {
      setMessage('请先补全冻结对象与冻结原因');
      return;
    }
    try {
      setFreezeSubmitting(true);
      await clientFetch('/admin/jobs-risk-controls/freeze', {
        method: 'POST',
        body: JSON.stringify({
          logId: selectedId,
          ...freezeForm,
          durationSeconds: Number(freezeForm.durationSeconds) || 3600,
          reviewNote: reviewForm.reviewNote,
        }),
      });
      setMessage('人工冻结已生效');
      await loadData(data.pagination.page || 1, filters);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '人工冻结失败');
    } finally {
      setFreezeSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Jobs risk workbench</p>
        <div className="mt-2">
          <h2 className="text-3xl font-bold text-ink">招聘风控人工审核工作台</h2>
          <p className="mt-2 text-sm text-muted">统一承接异常访问审计、审核状态流、人工冻结/解冻与关联日志排查。</p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-8">
        <Card className="rounded-3xl p-5"><p className="text-sm text-muted">近 24 小时请求</p><p className="mt-2 text-3xl font-bold text-ink">{data.summary.totalLast24h}</p></Card>
        <Card className="rounded-3xl p-5"><p className="text-sm text-muted">近 24 小时拒绝</p><p className="mt-2 text-3xl font-bold text-ink">{data.summary.deniedLast24h}</p></Card>
        <Card className="rounded-3xl p-5"><p className="text-sm text-muted">限流命中</p><p className="mt-2 text-3xl font-bold text-amber-600">{data.summary.limitLast24h}</p></Card>
        <Card className="rounded-3xl p-5"><p className="text-sm text-muted">风控命中</p><p className="mt-2 text-3xl font-bold text-rose-600">{data.summary.riskLast24h}</p></Card>
        <Card className="rounded-3xl p-5"><p className="text-sm text-muted">待审核</p><p className="mt-2 text-3xl font-bold text-sky-600">{data.summary.pendingReviewCount}</p></Card>
        <Card className="rounded-3xl p-5"><p className="text-sm text-muted">处理中</p><p className="mt-2 text-3xl font-bold text-violet-600">{data.summary.processingReviewCount}</p></Card>
        <Card className="rounded-3xl p-5"><p className="text-sm text-muted">当前生效处置</p><p className="mt-2 text-3xl font-bold text-brand">{data.summary.activeControlCount}</p></Card>
        <Card className="rounded-3xl p-5"><p className="text-sm text-muted">当前冻结数</p><p className="mt-2 text-3xl font-bold text-brand">{data.summary.activeFreezeCount}</p></Card>
      </section>

      <Card className="rounded-3xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-ink">风控参数配置</h3>
            <p className="mt-1 text-sm text-muted">当前默认已整体放宽一级至四级风控阈值和处置时长，支持在后台继续微调并即时生效。</p>
          </div>
          <Button disabled={riskConfigLoading || riskConfigSubmitting || !riskConfig} onClick={() => void handleRiskConfigSave()}>
            {riskConfigSubmitting ? '保存中...' : '保存风控参数'}
          </Button>
        </div>
        {riskConfigLoading ? (
          <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-6 text-sm text-muted">风控参数加载中...</p>
        ) : riskConfig ? (
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-ink">基础频控</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <ConfigNumberField config={riskConfig} label="详情每分钟" path={['accessLimits', 'detail', 'perMinute']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="详情十分钟" path={['accessLimits', 'detail', 'perTenMinutes']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="详情每小时" path={['accessLimits', 'detail', 'perHour']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="详情每日" path={['accessLimits', 'detail', 'perDay']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="公告每分钟" path={['accessLimits', 'viewAnnouncement', 'perMinute']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="公告十分钟" path={['accessLimits', 'viewAnnouncement', 'perTenMinutes']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="投递每分钟" path={['accessLimits', 'deliver', 'perMinute']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="投递十分钟" path={['accessLimits', 'deliver', 'perTenMinutes']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="公告每小时" path={['accessLimits', 'viewAnnouncement', 'perHour']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="公告每日" path={['accessLimits', 'viewAnnouncement', 'perDay']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="投递每小时" path={['accessLimits', 'deliver', 'perHour']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="投递每日" path={['accessLimits', 'deliver', 'perDay']} onChange={handleRiskConfigChange} />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-ink">主体倍率与一级规则</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <ConfigNumberField config={riskConfig} label="账号倍率" path={['accessLimits', 'scopeMultiplier', 'user']} onChange={handleRiskConfigChange} step="0.1" />
                  <ConfigNumberField config={riskConfig} label="IP 倍率" path={['accessLimits', 'scopeMultiplier', 'ip']} onChange={handleRiskConfigChange} step="0.1" />
                  <ConfigNumberField config={riskConfig} label="设备倍率" path={['accessLimits', 'scopeMultiplier', 'device']} onChange={handleRiskConfigChange} step="0.1" />
                  <ConfigNumberField config={riskConfig} label="会话倍率" path={['accessLimits', 'scopeMultiplier', 'session']} onChange={handleRiskConfigChange} step="0.1" />
                  <ConfigNumberField config={riskConfig} label="频控统计窗口(秒)" path={['controls', 'repeatedLimitHits', 'windowSeconds']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="账号频控阈值" path={['controls', 'repeatedLimitHits', 'userThreshold']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="IP 频控阈值" path={['controls', 'repeatedLimitHits', 'ipThreshold']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="设备频控阈值" path={['controls', 'repeatedLimitHits', 'deviceThreshold']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="账号冷却(秒)" path={['controls', 'repeatedLimitHits', 'userCooldownSeconds']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="IP 限制(秒)" path={['controls', 'repeatedLimitHits', 'ipRestrictSeconds']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="设备限制(秒)" path={['controls', 'repeatedLimitHits', 'deviceRestrictSeconds']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="规律翻页窗口(秒)" path={['controls', 'regularPageScan', 'windowSeconds']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="规律翻页账号阈值" path={['controls', 'regularPageScan', 'userThreshold']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="规律翻页 IP 阈值" path={['controls', 'regularPageScan', 'ipThreshold']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="规律翻页设备阈值" path={['controls', 'regularPageScan', 'deviceThreshold']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="规律翻页会话阈值" path={['controls', 'regularPageScan', 'sessionThreshold']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="规律翻页最大间隔(秒)" path={['controls', 'regularPageScan', 'maxGapSeconds']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="规律翻页冷却(秒)" path={['controls', 'regularPageScan', 'cooldownSeconds']} onChange={handleRiskConfigChange} />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-ink">二级至四级规则</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <ConfigNumberField config={riskConfig} label="日额度限制(秒)" path={['controls', 'dailyQuotaExceeded', 'restrictSeconds']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="不同岗位窗口(秒)" path={['controls', 'distinctJobBurst', 'windowSeconds']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="不同岗位账号阈值" path={['controls', 'distinctJobBurst', 'userThreshold']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="不同岗位 IP 阈值" path={['controls', 'distinctJobBurst', 'ipThreshold']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="不同岗位设备阈值" path={['controls', 'distinctJobBurst', 'deviceThreshold']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="不同岗位限制(秒)" path={['controls', 'distinctJobBurst', 'restrictSeconds']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="岗位枚举窗口(秒)" path={['controls', 'jobEnumeration', 'windowSeconds']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="岗位枚举账号阈值" path={['controls', 'jobEnumeration', 'userThreshold']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="岗位枚举 IP 阈值" path={['controls', 'jobEnumeration', 'ipThreshold']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="岗位枚举设备阈值" path={['controls', 'jobEnumeration', 'deviceThreshold']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="岗位枚举会话阈值" path={['controls', 'jobEnumeration', 'sessionThreshold']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="岗位枚举限制(秒)" path={['controls', 'jobEnumeration', 'restrictSeconds']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="深夜窗口(秒)" path={['controls', 'nightBurst', 'windowSeconds']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="深夜账号阈值" path={['controls', 'nightBurst', 'userThreshold']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="深夜 IP 阈值" path={['controls', 'nightBurst', 'ipThreshold']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="深夜设备阈值" path={['controls', 'nightBurst', 'deviceThreshold']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="深夜冻结(秒)" path={['controls', 'nightBurst', 'freezeSeconds']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="深夜开始时" path={['controls', 'nightBurst', 'startHour']} onChange={handleRiskConfigChange} min="0" />
                  <ConfigNumberField config={riskConfig} label="深夜结束时" path={['controls', 'nightBurst', 'endHour']} onChange={handleRiskConfigChange} min="0" />
                  <ConfigNumberField config={riskConfig} label="共享 IP 窗口(秒)" path={['controls', 'sharedIpUsers', 'windowSeconds']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="共享 IP 账号阈值" path={['controls', 'sharedIpUsers', 'threshold']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="共享 IP 冻结(秒)" path={['controls', 'sharedIpUsers', 'freezeSeconds']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="共享设备窗口(秒)" path={['controls', 'sharedDeviceUsers', 'windowSeconds']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="共享设备账号阈值" path={['controls', 'sharedDeviceUsers', 'threshold']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="共享设备冻结(秒)" path={['controls', 'sharedDeviceUsers', 'freezeSeconds']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="轮换 IP 窗口(秒)" path={['controls', 'userIpRotation', 'windowSeconds']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="轮换 IP 阈值" path={['controls', 'userIpRotation', 'threshold']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="轮换 IP 冻结(秒)" path={['controls', 'userIpRotation', 'freezeSeconds']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="升级窗口(秒)" path={['controls', 'escalation', 'windowSeconds']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="升级规则数阈值" path={['controls', 'escalation', 'distinctRuleThreshold']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="高等级重复阈值" path={['controls', 'escalation', 'severeHitThreshold']} onChange={handleRiskConfigChange} />
                  <ConfigNumberField config={riskConfig} label="四级冻结(秒)" path={['controls', 'escalation', 'freezeSeconds']} onChange={handleRiskConfigChange} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-6 text-sm text-muted">暂无可用风控参数。</p>
        )}
      </Card>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_460px]">
        <div className="space-y-4">
          <Card className="rounded-3xl p-4">
            <div className="grid gap-3 md:grid-cols-7">
              <Input placeholder="搜索用户 / IP / 设备 / 凭证 / 岗位" value={filters.keyword} onChange={(e) => setFilters((prev) => ({ ...prev, keyword: e.target.value }))} />
              <Select value={filters.action} onChange={(e) => setFilters((prev) => ({ ...prev, action: e.target.value }))}>
                <option value="">全部动作</option>
                <option value="view_announcement">查看公告</option>
                <option value="deliver">立即投递</option>
              </Select>
              <Select value={filters.requestStatus} onChange={(e) => setFilters((prev) => ({ ...prev, requestStatus: e.target.value }))}>
                <option value="">全部状态</option>
                <option value="issued">已签发</option>
                <option value="consumed">已消费</option>
                <option value="denied">已拒绝</option>
                <option value="expired">已过期</option>
              </Select>
              <Select value={filters.reviewStatus} onChange={(e) => setFilters((prev) => ({ ...prev, reviewStatus: e.target.value }))}>
                <option value="">全部审核状态</option>
                <option value="pending">待审核</option>
                <option value="processing">处理中</option>
                <option value="resolved">已处置</option>
                <option value="dismissed">已忽略</option>
              </Select>
              <Select value={filters.scope} onChange={(e) => setFilters((prev) => ({ ...prev, scope: e.target.value }))}>
                <option value="">全部对象范围</option>
                <option value="user">账号</option>
                <option value="ip">IP</option>
                <option value="device">设备</option>
              </Select>
              <Select value={filters.riskLevel} onChange={(e) => setFilters((prev) => ({ ...prev, riskLevel: e.target.value }))}>
                <option value="">全部风险等级</option>
                <option value="1">一级异常</option>
                <option value="2">二级异常</option>
                <option value="3">三级异常</option>
                <option value="4">四级异常</option>
              </Select>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => void loadData(1, filters)}>搜索</Button>
                <Button className="flex-1" variant="secondary" onClick={() => { setFilters(initialFilters); void loadData(1, initialFilters); }}>重置</Button>
              </div>
            </div>
          </Card>

          <Card className="rounded-3xl p-4">
            <div>
              <h3 className="text-lg font-semibold text-ink">当前生效处置</h3>
              <p className="mt-1 text-sm text-muted">统一展示冷却观察、限制查看、冻结动作，并标记规则来源、等级与剩余有效期。</p>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => setSelectedControlKeys((prev) => prev.length === data.activeControls.length ? [] : data.activeControls.map((item) => item.key))}
              >
                {selectedControlKeys.length && selectedControlKeys.length === data.activeControls.length ? '取消全选处置' : '全选当前处置'}
              </Button>
              <Button variant="secondary" disabled={batchUnfreezeSubmitting} onClick={() => void handleBatchUnfreeze()}>
                {batchUnfreezeSubmitting ? '批量解除中...' : `批量解除处置${selectedControlKeys.length ? `（${selectedControlKeys.length}）` : ''}`}
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              {data.activeControls.length ? data.activeControls.map((item) => (
                <div key={item.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <label className="mb-2 flex items-center gap-2 text-xs text-slate-500">
                        <input
                          type="checkbox"
                          checked={selectedControlKeys.includes(item.key)}
                          onChange={() => toggleControlSelection(item.key)}
                        />
                        选择该处置
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-ink">{item.scope} / {item.identifier}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${resolveRiskTone(item.level)}`}>{item.level} 级</span>
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700">{resolveControlLabel(item.controlType)}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{item.reason}</p>
                      <p className="mt-2 text-xs text-slate-500">来源：{item.source === 'manual' ? '人工处置' : '自动风控'} / 规则：{item.ruleKey || '-'}</p>
                      <p className="mt-1 text-xs text-slate-500">证据：{item.evidence || '-'}</p>
                      <p className="mt-1 text-xs text-slate-500">创建时间：{formatDate(item.createdAt)}</p>
                      <p className="mt-1 text-xs text-slate-500">剩余处置时间：{formatTtl(item.ttlSeconds)}</p>
                    </div>
                    <Button variant="secondary" disabled={unfreezingKey === item.key} onClick={() => void handleUnfreeze(item)}>
                      {unfreezingKey === item.key ? '处理中...' : '解除处置'}
                    </Button>
                  </div>
                </div>
              )) : (
                <p className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-muted">当前没有生效中的自动处置对象。</p>
              )}
            </div>
          </Card>

          <Card className="rounded-3xl p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => setSelectedLogIds((prev) => prev.length === data.list.length ? [] : data.list.map((item) => item.id))}
              >
                {selectedLogIds.length && selectedLogIds.length === data.list.length ? '取消全选记录' : '全选当前页记录'}
              </Button>
              <Button variant="secondary" disabled={batchReviewSubmitting} onClick={() => void handleBatchReviewSubmit()}>
                {batchReviewSubmitting ? '批量保存中...' : `批量保存审核${selectedLogIds.length ? `（${selectedLogIds.length}）` : ''}`}
              </Button>
            </div>
            <p className="mt-2 text-xs text-slate-500">批量审核将复用右侧当前填写的审核状态、处理结论和审核备注。</p>
          </Card>

          <AdminTable headers={['选择', '时间', '等级', '动作', '岗位', '用户', '审核状态', '建议处置', '当前生效动作']} hasData={data.list.length > 0} emptyText={loading ? '招聘风控记录加载中...' : '暂无风控记录'}>
            {data.list.map((item) => (
              <tr
                key={item.id}
                className={`cursor-pointer border-b border-slate-100 last:border-b-0 ${selectedId === item.id ? 'bg-brand/5' : 'hover:bg-slate-50'}`}
                onClick={() => setSelectedId(item.id)}
              >
                <td className="px-4 py-3 text-slate-600" onClick={(event) => event.stopPropagation()}>
                  <input type="checkbox" checked={selectedLogIds.includes(item.id)} onChange={() => toggleLogSelection(item.id)} />
                </td>
                <td className="px-4 py-3 text-slate-600">{formatDate(item.createdAt)}</td>
                <td className="px-4 py-3 text-slate-600"><span className={`rounded-full px-2 py-1 text-xs font-medium ${resolveRiskTone(item.riskLevel)}`}>{item.riskLevelLabel || '-'}</span></td>
                <td className="px-4 py-3 text-slate-600">{item.action}</td>
                <td className="px-4 py-3 font-medium text-ink">{item.jobId}</td>
                <td className="px-4 py-3 text-slate-600">{item.userPhone || item.userId || '-'}</td>
                <td className="px-4 py-3 text-slate-600">{item.reviewStatus}</td>
                <td className="px-4 py-3 text-slate-600">{item.riskDispositionLabel || item.requestStatus}</td>
                <td className="px-4 py-3 text-slate-600">{item.activeControls?.map((control) => `${control.controlLabel}:${control.scope}`).join('、') || '-'}</td>
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
          <h3 className="text-xl font-semibold text-ink">人工审核详情</h3>
          <p className="mt-1 text-sm text-muted">单案查看风险信号、关联日志、审核状态与人工冻结动作。</p>

          {detailLoading ? (
            <p className="mt-6 rounded-2xl bg-slate-50 px-4 py-6 text-sm text-muted">风控详情加载中...</p>
          ) : detail ? (
            <div className="mt-5 space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-ink">案件概览</p>
                <p className="mt-1 break-all">用户：{detail.item.userPhone || detail.item.userId || '-'}</p>
                <p className="mt-1 break-all">岗位：{detail.item.jobId}</p>
                <p className="mt-1">动作：{detail.item.action} / {detail.item.requestStatus}</p>
                <p className="mt-1">风险分类：{detail.item.riskReasonCategory || '-'}</p>
                <p className="mt-1">风险等级：{detail.item.riskLevelLabel || '-'}</p>
                <p className="mt-1">建议处置：{detail.item.riskDispositionLabel || '-'} / {detail.item.riskDispositionSummary || '-'}</p>
                <p className="mt-1">审核状态：{detail.item.reviewStatus}</p>
                <p className="mt-1">审核人：{detail.item.reviewedByAdminName || '-'}</p>
                <p className="mt-1">审核时间：{formatDate(detail.item.reviewedAt)}</p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-ink">风险信号</p>
                <p className="mt-1">同账号近 24 小时请求：{detail.signals.sameUserLast24h}</p>
                <p className="mt-1">同 IP 近 24 小时请求：{detail.signals.sameIpLast24h}</p>
                <p className="mt-1">同设备近 24 小时请求：{detail.signals.sameDeviceLast24h}</p>
                <p className="mt-1">同账号近 24 小时涉及 IP 数：{detail.signals.distinctIpsForUserLast24h}</p>
                <p className="mt-1">同 IP 近 24 小时涉及账号数：{detail.signals.distinctUsersForIpLast24h}</p>
                <p className="mt-1">同设备近 24 小时涉及账号数：{detail.signals.distinctUsersForDeviceLast24h}</p>
                <p className="mt-1">近期异常标签：{detail.signals.recentRiskReasons.join('、') || '-'}</p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-ink">来源信息</p>
                <p className="mt-1 break-all">IP：{detail.item.ip || '-'}</p>
                <p className="mt-1 break-all">设备：{detail.item.deviceId || '-'}</p>
                <p className="mt-1 break-all">会话：{detail.item.sessionId || '-'}</p>
                <p className="mt-1 break-all">UA：{detail.item.userAgent || '-'}</p>
                <p className="mt-1 whitespace-pre-wrap break-all">失败原因：{detail.item.failureReason || '-'}</p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-ink">人工审核</p>
                <div className="mt-3 grid gap-3">
                  <Select value={reviewForm.reviewStatus} onChange={(e) => setReviewForm((prev) => ({ ...prev, reviewStatus: e.target.value }))}>
                    <option value="pending">待审核</option>
                    <option value="processing">处理中</option>
                    <option value="resolved">已处置</option>
                    <option value="dismissed">已忽略</option>
                  </Select>
                  <Input placeholder="处理结论，如 manual_freeze_user / keep_watch" value={reviewForm.reviewConclusion} onChange={(e) => setReviewForm((prev) => ({ ...prev, reviewConclusion: e.target.value }))} />
                  <textarea
                    className="min-h-[96px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand"
                    placeholder="填写人工审核备注、证据判断、后续跟进建议"
                    value={reviewForm.reviewNote}
                    onChange={(e) => setReviewForm((prev) => ({ ...prev, reviewNote: e.target.value }))}
                  />
                  <Button disabled={reviewSubmitting} onClick={() => void handleReviewSubmit()}>
                    {reviewSubmitting ? '保存中...' : '保存审核结果'}
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-ink">人工冻结动作</p>
                <div className="mt-3 grid gap-3">
                  <Select value={freezeForm.scope} onChange={(e) => setFreezeForm((prev) => ({ ...prev, scope: e.target.value }))}>
                    <option value="user">冻结账号</option>
                    <option value="ip">冻结 IP</option>
                    <option value="device">冻结设备</option>
                  </Select>
                  <Input placeholder="冻结标识" value={freezeForm.identifier} onChange={(e) => setFreezeForm((prev) => ({ ...prev, identifier: e.target.value }))} />
                  <Input placeholder="冻结原因" value={freezeForm.reason} onChange={(e) => setFreezeForm((prev) => ({ ...prev, reason: e.target.value }))} />
                  <Input placeholder="冻结时长（秒）" value={freezeForm.durationSeconds} onChange={(e) => setFreezeForm((prev) => ({ ...prev, durationSeconds: e.target.value }))} />
                  <Button disabled={freezeSubmitting} onClick={() => void handleFreezeSubmit()}>
                    {freezeSubmitting ? '冻结中...' : '执行人工冻结'}
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-ink">当前生效动作</p>
                <div className="mt-3 space-y-2">
                  {detail.activeControls.length ? detail.activeControls.map((item) => (
                    <div key={item.key} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                      <p className="text-sm text-ink">{resolveControlLabel(item.controlType)} / {item.scope} / {item.identifier}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.level} 级异常，剩余 {formatTtl(item.ttlSeconds)}</p>
                      <p className="mt-1 break-all text-xs text-slate-500">{item.reason}</p>
                    </div>
                  )) : (
                    <p className="rounded-xl bg-white px-3 py-3 text-sm text-muted">当前案件没有仍在生效中的自动处置。</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-ink">关联日志</p>
                <div className="mt-3 space-y-3">
                  {detail.relatedLogs.map((item) => (
                    <div key={item.id} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                      <p className="text-xs text-slate-500">{formatDate(item.createdAt)}</p>
                      <p className="mt-1 text-sm text-ink">{item.action} / {item.requestStatus} / {item.reviewStatus}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.riskLevelLabel || '-'} / {item.riskDispositionLabel || '-'}</p>
                      <p className="mt-1 break-all text-xs text-slate-500">{item.failureReason || item.reviewConclusion || '-'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-6 rounded-2xl bg-slate-50 px-4 py-6 text-sm text-muted">请先从左侧选择一条风控记录。</p>
          )}
        </Card>
      </section>
    </div>
  );
}
