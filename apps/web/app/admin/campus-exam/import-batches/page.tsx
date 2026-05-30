'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { CampusExamAdminNav } from '@/components/admin/campus-exam-admin-nav';
import { AdminTable } from '@/components/admin/admin-table';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type {
  CampusExamAdminCategory,
  CampusExamAdminImportBatch,
  CampusExamAdminImportBatchDetail,
  CampusExamAdminImportBatchError,
  CampusExamAdminQuestionListItem,
  CampusExamAdminSpecial,
  CampusExamListResponse,
} from '@/lib/campus-exam';
import { buildQuery } from '@/lib/admin';
import { clientFetch } from '@/lib/api';
import { formatDate } from '@/lib/utils';

const initialFilters = {
  batchId: '',
  categoryId: '',
  specialId: '',
  status: '',
};

export default function CampusExamAdminImportBatchesPage() {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState<CampusExamListResponse<CampusExamAdminImportBatch>>({
    list: [],
    pagination: { page: 1, limit: 10, total: 0, hasMore: false },
  });
  const [categories, setCategories] = useState<CampusExamAdminCategory[]>([]);
  const [specials, setSpecials] = useState<CampusExamAdminSpecial[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [detail, setDetail] = useState<CampusExamAdminImportBatchDetail | null>(null);
  const [errors, setErrors] = useState<CampusExamAdminImportBatchError[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [message, setMessage] = useState('');

  const page = data.pagination.page || 1;
  const pageSize = data.pagination.limit || 10;

  const loadOptions = async () => {
    try {
      const [categoryResult, specialResult] = await Promise.all([
        clientFetch<CampusExamListResponse<CampusExamAdminCategory>>('/admin/campus-exam/categories?page=1&pageSize=100'),
        clientFetch<CampusExamListResponse<CampusExamAdminSpecial>>('/admin/campus-exam/specials?page=1&pageSize=200'),
      ]);
      setCategories(categoryResult.list);
      setSpecials(specialResult.list);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '筛选项加载失败');
    }
  };

  const loadData = async (nextPage = page, nextFilters = filters) => {
    try {
      setLoading(true);
      const query = buildQuery({
        categoryId: nextFilters.categoryId,
        specialId: nextFilters.specialId,
        status: nextFilters.status,
        page: nextPage,
        pageSize,
      });
      const result = await clientFetch<CampusExamListResponse<CampusExamAdminImportBatch>>(`/admin/campus-exam/import-batches?${query}`);
      setData(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导入批次加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadBatchDetail = async (batchId: string) => {
    try {
      const [detailResult, errorResult] = await Promise.all([
        clientFetch<CampusExamAdminImportBatchDetail>(`/admin/campus-exam/import-batches/${batchId}`),
        clientFetch<CampusExamAdminImportBatchError[]>(`/admin/campus-exam/import-batches/${batchId}/errors`),
      ]);
      setDetail(detailResult);
      setErrors(errorResult);
      setSelectedBatchId(batchId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导入批次详情加载失败');
    }
  };

  useEffect(() => {
    const batchId = searchParams.get('batchId') ?? '';
    const nextFilters = { ...initialFilters, batchId };
    setFilters(nextFilters);
    void Promise.all([loadOptions(), loadData(1, nextFilters)]);
    if (batchId) {
      void loadBatchDetail(batchId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetryAssets = async () => {
    if (!selectedBatchId) return;
    try {
      setRetrying(true);
      const result = await clientFetch<{ updatedCount: number; failedCount: number }>(
        `/admin/campus-exam/import-batches/${selectedBatchId}/retry-assets`,
        { method: 'POST' },
      );
      setMessage(`资源重试完成：成功 ${result.updatedCount}，失败 ${result.failedCount}`);
      await loadBatchDetail(selectedBatchId);
      await loadData(page, filters);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '资源重试失败');
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Campus exam admin</p>
        <div className="mt-2">
          <h2 className="text-3xl font-bold text-ink">校招笔试导入批次</h2>
          <p className="mt-2 text-sm text-muted">统一查看 Excel 预览、正式导入、错误明细和 OSS 转存状态，并支持失败资源重试。</p>
        </div>
        <div className="mt-4">
          <CampusExamAdminNav />
        </div>
      </section>

      {message ? <Card className="p-4 text-sm text-slate-600">{message}</Card> : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <Card className="rounded-3xl p-4">
            <div className="grid gap-3 md:grid-cols-5">
              <Input
                placeholder="按批次 ID 快速定位"
                value={filters.batchId}
                onChange={(event) => setFilters((prev) => ({ ...prev, batchId: event.target.value }))}
              />
              <Select
                value={filters.categoryId}
                onChange={(event) => setFilters((prev) => ({ ...prev, categoryId: event.target.value }))}
              >
                <option value="">全部一级分类</option>
                {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
              <Select
                value={filters.specialId}
                onChange={(event) => setFilters((prev) => ({ ...prev, specialId: event.target.value }))}
              >
                <option value="">全部二级分类</option>
                {specials
                  .filter((item) => !filters.categoryId || item.categoryId === filters.categoryId)
                  .map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
              <Select
                value={filters.status}
                onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
              >
                <option value="">全部状态</option>
                <option value="previewed">previewed</option>
                <option value="previewed_with_errors">previewed_with_errors</option>
                <option value="imported">imported</option>
                <option value="imported_with_errors">imported_with_errors</option>
              </Select>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => {
                    if (filters.batchId) {
                      void loadBatchDetail(filters.batchId);
                    }
                    void loadData(1, filters);
                  }}
                >
                  搜索
                </Button>
                <Button
                  className="flex-1"
                  variant="secondary"
                  onClick={() => {
                    setFilters(initialFilters);
                    setDetail(null);
                    setErrors([]);
                    setSelectedBatchId('');
                    void loadData(1, initialFilters);
                  }}
                >
                  重置
                </Button>
              </div>
            </div>
          </Card>

          <AdminTable
            headers={['文件名', '专项', '一级分类', '成功率', '状态', '更新时间']}
            hasData={data.list.length > 0}
            emptyText={loading ? '导入批次加载中...' : '暂无导入批次'}
          >
            {data.list.map((item) => {
              const successRate = item.totalCount ? `${Math.round((item.successCount / item.totalCount) * 100)}%` : '0%';
              return (
                <tr
                  key={item.id}
                  className={`cursor-pointer border-b border-slate-100 last:border-b-0 ${selectedBatchId === item.id ? 'bg-brand/5' : 'hover:bg-slate-50'}`}
                  onClick={() => void loadBatchDetail(item.id)}
                >
                  <td className="px-4 py-3 font-medium text-ink">{item.fileName}</td>
                  <td className="px-4 py-3 text-slate-600">{item.specialName}</td>
                  <td className="px-4 py-3 text-slate-600">{item.categoryName}</td>
                  <td className="px-4 py-3 text-slate-600">{successRate}</td>
                  <td className="px-4 py-3 text-slate-600">{item.status}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(item.updatedAt)}</td>
                </tr>
              );
            })}
          </AdminTable>

          <AdminPagination
            page={page}
            limit={pageSize}
            total={data.pagination.total || 0}
            onPageChange={(nextPage) => void loadData(nextPage, filters)}
          />
        </div>

        <Card className="rounded-3xl p-5 xl:sticky xl:top-6 xl:self-start">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-ink">批次详情</h3>
              <p className="mt-1 text-sm text-muted">点击左侧批次后显示预览摘要、错误明细和资源状态。</p>
            </div>
            {selectedBatchId ? (
              <Button variant="secondary" onClick={() => void handleRetryAssets()} disabled={retrying}>
                {retrying ? '重试中...' : '重试资源转存'}
              </Button>
            ) : null}
          </div>

          {detail ? (
            <div className="mt-5 space-y-5">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">批次 ID</p>
                  <p className="mt-2 break-all text-sm font-semibold text-ink">{detail.id}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">状态</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{detail.status}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">题量统计</p>
                  <p className="mt-2 text-sm font-semibold text-ink">总 {detail.totalCount} / 成功 {detail.successCount} / 失败 {detail.failCount}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">专项</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{detail.categoryName} · {detail.specialName}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-ink">错误明细</p>
                <div className="mt-3 max-h-[260px] space-y-2 overflow-auto">
                  {errors.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-rose-100 bg-rose-50 p-3 text-xs leading-5 text-rose-700">
                      第 {item.rowNo} 行 · {item.fieldName} · {item.errorCode}
                      <div className="mt-1">{item.errorMessage}</div>
                    </div>
                  ))}
                  {!errors.length ? <p className="text-sm text-slate-500">当前批次没有错误记录。</p> : null}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-ink">最近入库题目</p>
                <div className="mt-3 space-y-2">
                  {detail.questions.slice(0, 5).map((item: CampusExamAdminQuestionListItem) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 p-3 text-sm text-slate-600">
                      <p className="font-medium text-ink">{item.questionTypeLabel} · {item.assetTransferStatus}</p>
                      <div className="mt-2 line-clamp-2" dangerouslySetInnerHTML={{ __html: item.stemPreviewHtml }} />
                    </div>
                  ))}
                  {!detail.questions.length ? <p className="text-sm text-slate-500">当前批次还没有正式入库题目。</p> : null}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-5 text-sm text-slate-500">请选择左侧某个导入批次查看详情。</p>
          )}
        </Card>
      </section>
    </div>
  );
}
