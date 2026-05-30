'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { CampusExamAdminNav } from '@/components/admin/campus-exam-admin-nav';
import { AdminTable } from '@/components/admin/admin-table';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { CampusExamAdminCategory, CampusExamListResponse } from '@/lib/campus-exam';
import { buildQuery } from '@/lib/admin';
import { clientFetch } from '@/lib/api';
import { formatDate } from '@/lib/utils';

const initialFilters = {
  keyword: '',
  status: '',
};

const emptyForm = {
  name: '',
  slug: '',
  description: '',
  sortOrder: '0',
  status: 'active',
};

export default function CampusExamAdminCategoriesPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState<CampusExamListResponse<CampusExamAdminCategory>>({
    list: [],
    pagination: { page: 1, limit: 10, total: 0, hasMore: false },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(emptyForm);

  const page = data.pagination.page || 1;
  const pageSize = data.pagination.limit || 10;

  const loadData = async (nextPage = page, nextFilters = filters) => {
    try {
      setLoading(true);
      const query = buildQuery({ ...nextFilters, page: nextPage, pageSize });
      const result = await clientFetch<CampusExamListResponse<CampusExamAdminCategory>>(`/admin/campus-exam/categories?${query}`);
      setData(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '一级分类加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData(1, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedCategory = useMemo(
    () => data.list.find((item) => item.id === selectedId) ?? null,
    [data.list, selectedId],
  );

  const handleSelect = (item: CampusExamAdminCategory) => {
    setSelectedId(item.id);
    setForm({
      name: item.name,
      slug: item.slug,
      description: item.description ?? '',
      sortOrder: String(item.sortOrder),
      status: item.status,
    });
  };

  const resetForm = () => {
    setSelectedId('');
    setForm(emptyForm);
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      const payload = {
        ...form,
        sortOrder: Number(form.sortOrder || 0),
      };
      const result = selectedId
        ? await clientFetch<CampusExamAdminCategory>(`/admin/campus-exam/categories/${selectedId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : await clientFetch<CampusExamAdminCategory>('/admin/campus-exam/categories', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
      setMessage(selectedId ? '一级分类已更新' : '一级分类已创建');
      setSelectedId(result.id);
      await loadData(selectedId ? page : 1, filters);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '一级分类保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Campus exam admin</p>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-ink">校招笔试一级分类管理</h2>
            <p className="mt-2 text-sm text-muted">维护分类名称、slug、状态与排序，同时为二级专项和导入入口提供上游结构。</p>
          </div>
          <Button onClick={resetForm}>新增一级分类</Button>
        </div>
        <div className="mt-4">
          <CampusExamAdminNav />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Link href="/admin/campus-exam/specials" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card transition hover:border-brand">
          <p className="text-sm font-semibold text-ink">进入二级分类</p>
          <p className="mt-2 text-sm text-slate-500">继续维护专项、查看题量和导入入口。</p>
        </Link>
        <Link href="/admin/campus-exam/import-batches" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card transition hover:border-brand">
          <p className="text-sm font-semibold text-ink">查看导入批次</p>
          <p className="mt-2 text-sm text-slate-500">追踪 Excel 预览、正式导入和 OSS 转存结果。</p>
        </Link>
        <Link href="/admin/campus-exam/quality" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card transition hover:border-brand">
          <p className="text-sm font-semibold text-ink">进入主观题质检</p>
          <p className="mt-2 text-sm text-slate-500">聚焦 `pending` 或低分样本，沉淀规则优化依据。</p>
        </Link>
      </section>

      {message ? (
        <Card className="p-4 text-sm text-slate-600">{message}</Card>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card className="rounded-3xl p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                placeholder="搜索分类名称或 slug"
                value={filters.keyword}
                onChange={(event) => setFilters((prev) => ({ ...prev, keyword: event.target.value }))}
              />
              <Select
                value={filters.status}
                onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
              >
                <option value="">全部状态</option>
                <option value="active">启用</option>
                <option value="inactive">停用</option>
              </Select>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => void loadData(1, filters)}>搜索</Button>
                <Button
                  className="flex-1"
                  variant="secondary"
                  onClick={() => {
                    setFilters(initialFilters);
                    void loadData(1, initialFilters);
                  }}
                >
                  重置
                </Button>
              </div>
            </div>
          </Card>

          <AdminTable
            headers={['分类名称', 'Slug', '专项数', '状态', '排序', '更新时间']}
            hasData={data.list.length > 0}
            emptyText={loading ? '一级分类加载中...' : '暂无一级分类'}
          >
            {data.list.map((item) => (
              <tr
                key={item.id}
                className={`cursor-pointer border-b border-slate-100 last:border-b-0 ${selectedId === item.id ? 'bg-brand/5' : 'hover:bg-slate-50'}`}
                onClick={() => handleSelect(item)}
              >
                <td className="px-4 py-3 font-medium text-ink">{item.name}</td>
                <td className="px-4 py-3 text-slate-600">{item.slug}</td>
                <td className="px-4 py-3 text-slate-600">{item.specialCount}</td>
                <td className="px-4 py-3 text-slate-600">{item.status}</td>
                <td className="px-4 py-3 text-slate-600">{item.sortOrder}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(item.updatedAt)}</td>
              </tr>
            ))}
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
              <h3 className="text-xl font-semibold text-ink">{selectedCategory ? '编辑一级分类' : '新增一级分类'}</h3>
              <p className="mt-1 text-sm text-muted">`slug` 不填则按名称自动生成，建议保持简短稳定。</p>
            </div>
            {selectedCategory ? <Button variant="ghost" onClick={resetForm}>切换新增</Button> : null}
          </div>

          <div className="mt-5 space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">分类名称</span>
              <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">Slug</span>
              <Input value={form.slug} onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">描述</span>
              <Textarea
                className="min-h-[120px]"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-ink">排序</span>
                <Input value={form.sortOrder} onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: event.target.value }))} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-ink">状态</span>
                <Select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}>
                  <option value="active">启用</option>
                  <option value="inactive">停用</option>
                </Select>
              </label>
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <Button className="flex-1" onClick={() => void handleSubmit()} disabled={saving}>
              {saving ? '保存中...' : selectedCategory ? '保存修改' : '创建分类'}
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
}
