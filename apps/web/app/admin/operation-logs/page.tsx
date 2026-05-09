'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { AdminTable } from '@/components/admin/admin-table';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { buildQuery } from '@/lib/admin';
import { clientFetch } from '@/lib/api';
import { useGlobalToast } from '@/store/toast-store';
import { formatDate } from '@/lib/utils';
import { AdminListResponse, AdminOperationLogItem } from '@/types';

const initialFilters = {
  keyword: '',
  module: '',
  action: '',
};

const moduleOptions = ['admin-users', 'admin-roles', 'users', 'orders', 'jobs', 'memberships', 'membership-contents', 'service-products', 'commission-config', 'redeem-batches', 'redeem-codes'];
const actionOptions = ['create', 'update', 'delete', 'update-status', 'reset-password', 'import', 'export', 'download-template'];

export default function AdminOperationLogsPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState<AdminListResponse<AdminOperationLogItem>>({
    list: [],
    pagination: { page: 1, limit: 10, total: 0, hasMore: false },
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [selectedId, setSelectedId] = useState('');

  useGlobalToast(message, setMessage);

  const selectedLog = useMemo(() => data.list.find((item) => item.id === selectedId) ?? null, [data.list, selectedId]);

  const loadData = async (page = 1, nextFilters = filters) => {
    try {
      setLoading(true);
      const result = await clientFetch<AdminListResponse<AdminOperationLogItem>>(`/admin/operation-logs?${buildQuery({ ...nextFilters, page, limit: 10 })}`);
      setData(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作日志加载失败');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void loadData(1, filters);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Admin operation logs</p>
        <div className="mt-2 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-ink">后台操作日志</h2>
            <p className="mt-2 text-sm text-muted">统一追踪后台关键写操作，记录操作人、模块、动作、请求参数摘要与结果摘要。</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <Card className="rounded-3xl p-4">
            <div className="grid gap-3 md:grid-cols-4">
              <Input placeholder="搜索操作人 / 模块 / 目标 / 摘要" value={filters.keyword} onChange={(e) => setFilters((prev) => ({ ...prev, keyword: e.target.value }))} />
              <Select value={filters.module} onChange={(e) => setFilters((prev) => ({ ...prev, module: e.target.value }))}>
                <option value="">全部模块</option>
                {moduleOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
              <Select value={filters.action} onChange={(e) => setFilters((prev) => ({ ...prev, action: e.target.value }))}>
                <option value="">全部动作</option>
                {actionOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => void loadData(1, filters)}>搜索</Button>
                <Button className="flex-1" variant="secondary" onClick={() => { setFilters(initialFilters); void loadData(1, initialFilters); }}>重置</Button>
              </div>
            </div>
          </Card>

          <AdminTable headers={['时间', '操作人', '模块', '动作', '结果摘要']} hasData={data.list.length > 0} emptyText={loading ? '操作日志加载中...' : '暂无操作日志'}>
            {data.list.map((item) => (
              <tr
                key={item.id}
                className={`cursor-pointer border-b border-slate-100 last:border-b-0 ${selectedId === item.id ? 'bg-brand/5' : 'hover:bg-slate-50'}`}
                onClick={() => setSelectedId(item.id)}
              >
                <td className="px-4 py-3 text-slate-600">{formatDate(item.createdAt)}</td>
                <td className="px-4 py-3 font-medium text-ink">{item.adminRealName || item.adminUsername || '-'}</td>
                <td className="px-4 py-3 text-slate-600">{item.module}</td>
                <td className="px-4 py-3 text-slate-600">{item.action}</td>
                <td className="px-4 py-3 text-slate-600">{item.responseSummary || '-'}</td>
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
          <h3 className="text-xl font-semibold text-ink">日志详情</h3>
          <p className="mt-1 text-sm text-muted">可查看本次后台操作的目标、请求路径、参数摘要和返回摘要，便于审计与排查。</p>

          {selectedLog ? (
            <div className="mt-5 space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-ink">操作人</p>
                <p className="mt-1">{selectedLog.adminRealName || selectedLog.adminUsername || '-'}</p>
                <p className="mt-2 font-semibold text-ink">操作时间</p>
                <p className="mt-1">{formatDate(selectedLog.createdAt)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-ink">模块 / 动作</p>
                <p className="mt-1">{selectedLog.module} / {selectedLog.action}</p>
                <p className="mt-2 font-semibold text-ink">目标对象</p>
                <p className="mt-1">{selectedLog.targetType || '-'} / {selectedLog.targetId || '-'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-ink">请求方法 / 路径</p>
                <p className="mt-1">{selectedLog.requestMethod || '-'} {selectedLog.requestPath || '-'}</p>
                <p className="mt-2 font-semibold text-ink">结果摘要</p>
                <p className="mt-1">{selectedLog.responseSummary || '-'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-ink">来源信息</p>
                <p className="mt-1">IP：{selectedLog.ip || '-'}</p>
                <p className="mt-1 break-all">UA：{selectedLog.userAgent || '-'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-ink">请求参数摘要</p>
                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded-2xl bg-white p-3 text-xs leading-6 text-slate-600">{JSON.stringify(selectedLog.requestPayload ?? {}, null, 2)}</pre>
              </div>
            </div>
          ) : (
            <p className="mt-6 rounded-2xl bg-slate-50 px-4 py-6 text-sm text-muted">请先从左侧选择一条操作日志。</p>
          )}
        </Card>
      </section>
    </div>
  );
}
