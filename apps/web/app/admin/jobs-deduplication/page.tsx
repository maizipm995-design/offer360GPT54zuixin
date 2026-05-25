'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { clientFetch } from '@/lib/api';
import { ADMIN_TOAST_COPY } from '@/lib/toast-copy';
import { formatDate } from '@/lib/utils';
import { useGlobalToast } from '@/store/toast-store';
import {
  AdminJobDeduplicationExecuteResult,
  AdminJobDeduplicationGroup,
  AdminJobDeduplicationPreview,
} from '@/types';

function renderFieldValue(value: string) {
  return value || '空值';
}

function DuplicateGroupCard({ group, index }: { group: AdminJobDeduplicationGroup; index: number }) {
  return (
    <Card className="rounded-3xl p-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">重复分组 {index + 1}</p>
          <h3 className="mt-2 text-lg font-semibold text-ink">{renderFieldValue(group.keepRecord.companyFullName)}</h3>
          <p className="mt-2 text-sm text-slate-500">本组重复记录 {group.duplicateCount} 条，系统将保留更新时间最新的 1 条，其余自动删除。</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <p>保留记录更新时间：{formatDate(group.keepRecord.updatedAt)}</p>
          <p className="mt-1">待删除历史记录：{group.removeRecords.length} 条</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs text-slate-500">企业/单位全称</p>
          <p className="mt-2 break-all text-sm font-medium text-ink">{renderFieldValue(group.companyFullName)}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs text-slate-500">工作地点</p>
          <p className="mt-2 break-all text-sm font-medium text-ink">{renderFieldValue(group.workLocation)}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs text-slate-500">岗位名称</p>
          <p className="mt-2 break-all text-sm font-medium text-ink">{renderFieldValue(group.jobName)}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs text-slate-500">公告链接</p>
          <p className="mt-2 break-all text-sm font-medium text-ink">{renderFieldValue(group.announcementUrl)}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs text-slate-500">投递链接</p>
          <p className="mt-2 break-all text-sm font-medium text-ink">{renderFieldValue(group.deliveryUrl)}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-4">
          <p className="text-sm font-semibold text-emerald-700">保留记录</p>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <p>企业：{group.keepRecord.companyFullName}</p>
            <p>岗位：{renderFieldValue(group.keepRecord.jobName || '')}</p>
            <p>标题：{renderFieldValue(group.keepRecord.announcementTitle || '')}</p>
            <p>录入日期：{formatDate(group.keepRecord.entryDate)}</p>
            <p>更新时间：{formatDate(group.keepRecord.updatedAt)}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-rose-200 bg-rose-50/60 p-4">
          <p className="text-sm font-semibold text-rose-700">待删除记录</p>
          <div className="mt-3 space-y-3">
            {group.removeRecords.map((item) => (
              <div key={item.id} className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600">
                <p className="font-medium text-ink">{item.companyFullName}</p>
                <p className="mt-1">岗位：{renderFieldValue(item.jobName || '')}</p>
                <p className="mt-1">标题：{renderFieldValue(item.announcementTitle || '')}</p>
                <p className="mt-1">录入日期：{formatDate(item.entryDate)}</p>
                <p className="mt-1">更新时间：{formatDate(item.updatedAt)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function AdminJobsDeduplicationPage() {
  const [preview, setPreview] = useState<AdminJobDeduplicationPreview | null>(null);
  const [executionResult, setExecutionResult] = useState<AdminJobDeduplicationExecuteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [message, setMessage] = useState('');
  const [lastCheckedAt, setLastCheckedAt] = useState<string>('');

  useGlobalToast(message, setMessage);

  const loadPreview = useCallback(async (showToast = false) => {
    try {
      setLoading(true);
      const result = await clientFetch<AdminJobDeduplicationPreview>('/admin/jobs/deduplication/preview');
      setPreview(result);
      setLastCheckedAt(new Date().toISOString());
      if (showToast) {
        setMessage(result.duplicateGroupCount ? `重复公告检测已完成，发现 ${result.duplicateGroupCount} 组` : '重复公告检测已完成，当前没有重复数据');
      }
      return result;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.operationFailed('招聘公告重复检测'));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPreview(false);
  }, [loadPreview]);

  const summaryCards = useMemo(() => {
    if (!preview) return [];
    return [
      { label: '扫描总记录', value: preview.scannedCount, tone: 'text-ink' },
      { label: '重复分组数', value: preview.duplicateGroupCount, tone: 'text-amber-600' },
      { label: '重复记录数', value: preview.duplicateRecordCount, tone: 'text-rose-600' },
      { label: '待删除记录', value: preview.pendingDeleteCount, tone: 'text-brand' },
    ];
  }, [preview]);

  const handleExecute = async () => {
    if (!preview) {
      const latestPreview = await loadPreview(false);
      if (!latestPreview) return;
      if (!latestPreview.pendingDeleteCount) {
        setMessage(ADMIN_TOAST_COPY.noOperableData('招聘公告'));
        return;
      }
    } else if (!preview.pendingDeleteCount) {
      setMessage(ADMIN_TOAST_COPY.noOperableData('招聘公告'));
      return;
    }

    if (!window.confirm('确认执行智能去重吗？系统会保留每组中更新时间最新的一条，并永久删除其余重复公告。')) {
      return;
    }

    try {
      setExecuting(true);
      const result = await clientFetch<AdminJobDeduplicationExecuteResult>('/admin/jobs/deduplication/execute', {
        method: 'POST',
      });
      setExecutionResult(result);
      setMessage(result.deletedCount ? `招聘公告去重已完成，共清理 ${result.deletedCount} 条重复记录` : '招聘公告去重已完成，当前无需清理');
      await loadPreview(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.operationFailed('招聘公告去重'));
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Jobs deduplication</p>
        <div className="mt-2 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-ink">招聘公告智能去重</h2>
            <p className="mt-2 text-sm text-muted">系统按“企业/单位全称 + 工作地点 + 岗位名称 + 公告链接 + 投递链接”5 个核心字段同时完全一致来判定重复，并自动保留更新时间最新的一条公告。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void loadPreview(true)} disabled={loading || executing}>
              {loading ? '检测中...' : '一键检测重复'}
            </Button>
            <Button onClick={() => void handleExecute()} disabled={loading || executing || !preview?.pendingDeleteCount}>
              {executing ? '去重处理中...' : '一键执行去重'}
            </Button>
          </div>
        </div>
      </section>

      {preview ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((item) => (
            <Card key={item.label} className="rounded-3xl p-5">
              <p className="text-sm text-muted">{item.label}</p>
              <p className={`mt-3 text-3xl font-bold ${item.tone}`}>{item.value}</p>
            </Card>
          ))}
        </section>
      ) : (
        <Card className="rounded-3xl p-8 text-sm text-muted">
          正在加载招聘公告重复检测结果...
        </Card>
      )}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {preview && preview.groups.length ? (
            preview.groups.map((group, index) => (
              <DuplicateGroupCard
                key={`${group.companyFullName}-${group.workLocation}-${group.jobName}-${group.announcementUrl}-${group.deliveryUrl}-${index}`}
                group={group}
                index={index}
              />
            ))
          ) : (
            <Card className="rounded-3xl p-8">
              <h3 className="text-xl font-semibold text-ink">重复分组明细</h3>
              <p className="mt-3 text-sm leading-6 text-slate-500">当前没有检测到重复公告。后续新增或导入数据后，可随时再次点击“一键检测重复”。</p>
            </Card>
          )}
        </div>

        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <Card className="rounded-3xl p-5">
            <h3 className="text-lg font-semibold text-ink">检测说明</h3>
            <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
              <p>1. 判定口径固定为企业/单位全称、工作地点、岗位名称、公告链接、投递链接 5 个字段同时完全一致。</p>
              <p>2. 每组重复公告只保留更新时间最新的一条。</p>
              <p>3. 其余历史重复记录会在执行后永久删除，无法撤销。</p>
              <p>4. 5 个关键字段同时为空的记录不会自动去重，避免误删无标识数据。</p>
            </div>
          </Card>

          <Card className="rounded-3xl p-5">
            <h3 className="text-lg font-semibold text-ink">最近状态</h3>
            <div className="mt-3 space-y-3 text-sm text-slate-600">
              <p>最近检测时间：{lastCheckedAt ? formatDate(lastCheckedAt) : '尚未检测'}</p>
              <p>当前待删除记录：{preview?.pendingDeleteCount ?? 0}</p>
              <p>当前重复分组：{preview?.duplicateGroupCount ?? 0}</p>
            </div>
          </Card>

          <Card className="rounded-3xl p-5">
            <h3 className="text-lg font-semibold text-ink">最近执行结果</h3>
            {executionResult ? (
              <div className="mt-3 space-y-3 text-sm text-slate-600">
                <p>扫描记录：{executionResult.scannedCount}</p>
                <p>重复分组：{executionResult.duplicateGroupCount}</p>
                <p>保留记录：{executionResult.keptCount}</p>
                <p>删除记录：{executionResult.deletedCount}</p>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-500">执行智能去重后，这里会展示本次处理结果，方便后台复核。</p>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}
