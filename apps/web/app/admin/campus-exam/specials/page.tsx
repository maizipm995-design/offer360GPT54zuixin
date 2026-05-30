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
import type {
  CampusExamAdminCategory,
  CampusExamAdminSpecial,
  CampusExamListResponse,
} from '@/lib/campus-exam';
import { buildQuery } from '@/lib/admin';
import { clientFetch } from '@/lib/api';
import { formatDate } from '@/lib/utils';

const initialFilters = {
  categoryId: '',
  keyword: '',
  status: '',
};

const emptyForm = {
  id: '',
  categoryId: '',
  name: '',
  description: '',
  sortOrder: '0',
  status: 'active',
};

export default function CampusExamAdminSpecialsPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState<CampusExamListResponse<CampusExamAdminSpecial>>({
    list: [],
    pagination: { page: 1, limit: 10, total: 0, hasMore: false },
  });
  const [categories, setCategories] = useState<CampusExamAdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const page = data.pagination.page || 1;
  const pageSize = data.pagination.limit || 10;

  const loadCategories = async () => {
    try {
      const result = await clientFetch<CampusExamListResponse<CampusExamAdminCategory>>(
        '/admin/campus-exam/categories?page=1&pageSize=100',
      );
      setCategories(result.list);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '一级分类选项加载失败');
    }
  };

  const loadData = async (nextPage = page, nextFilters = filters) => {
    try {
      setLoading(true);
      const query = buildQuery({ ...nextFilters, page: nextPage, pageSize });
      const result = await clientFetch<CampusExamListResponse<CampusExamAdminSpecial>>(`/admin/campus-exam/specials?${query}`);
      setData(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '二级分类加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void Promise.all([loadCategories(), loadData(1, filters)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedSpecial = useMemo(
    () => data.list.find((item) => item.id === selectedId) ?? null,
    [data.list, selectedId],
  );

  const handleSelect = (item: CampusExamAdminSpecial) => {
    setSelectedId(item.id);
    setForm({
      id: String(item.id),
      categoryId: item.categoryId,
      name: item.name,
      description: item.description ?? '',
      sortOrder: String(item.sortOrder),
      status: item.status,
    });
  };

  const resetForm = () => {
    setSelectedId(null);
    setForm(emptyForm);
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      const payload = {
        id: Number(form.id),
        categoryId: form.categoryId,
        name: form.name,
        description: form.description,
        sortOrder: Number(form.sortOrder || 0),
        status: form.status,
      };
      if (!selectedId) {
        await clientFetch<CampusExamAdminSpecial>('/admin/campus-exam/specials', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } else {
        await clientFetch<CampusExamAdminSpecial>(`/admin/campus-exam/specials/${selectedId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      }
      setMessage(selectedId ? '二级分类已更新' : '二级分类已创建');
      await loadData(selectedId ? page : 1, filters);
      if (!selectedId) {
        resetForm();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '二级分类保存失败');
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
            <h2 className="text-3xl font-bold text-ink">校招笔试二级分类管理</h2>
            <p className="mt-2 text-sm text-muted">维护 Excel `分类专项id` 对齐的专项结构，并进入专项详情页完成题库上传预览。</p>
          </div>
          <Button onClick={resetForm}>新增二级分类</Button>
        </div>
        <div className="mt-4">
          <CampusExamAdminNav />
        </div>
      </section>

      {message ? <Card className="p-4 text-sm text-slate-600">{message}</Card> : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <Card className="rounded-3xl p-4">
            <div className="grid gap-3 md:grid-cols-4">
              <Select
                value={filters.categoryId}
                onChange={(event) => setFilters((prev) => ({ ...prev, categoryId: event.target.value }))}
              >
                <option value="">全部一级分类</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </Select>
              <Input
                placeholder="搜索专项名称"
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
            headers={['专项ID', '专项名称', '一级分类', '题量', '导入批次', '状态', '更新时间']}
            hasData={data.list.length > 0}
            emptyText={loading ? '二级分类加载中...' : '暂无二级分类'}
          >
            {data.list.map((item) => (
              <tr
                key={item.id}
                className={`cursor-pointer border-b border-slate-100 last:border-b-0 ${selectedId === item.id ? 'bg-brand/5' : 'hover:bg-slate-50'}`}
                onClick={() => handleSelect(item)}
              >
                <td className="px-4 py-3 font-medium text-ink">{item.id}</td>
                <td className="px-4 py-3 text-slate-600">
                  <div className="flex flex-col">
                    <span>{item.name}</span>
                    <Link href={`/admin/campus-exam/specials/${item.id}`} className="text-xs text-brand hover:underline">
                      进入专项详情
                    </Link>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">{item.categoryName}</td>
                <td className="px-4 py-3 text-slate-600">{item.questionCount}</td>
                <td className="px-4 py-3 text-slate-600">{item.importBatchCount}</td>
                <td className="px-4 py-3 text-slate-600">{item.status}</td>
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
              <h3 className="text-xl font-semibold text-ink">{selectedSpecial ? '编辑二级分类' : '新增二级分类'}</h3>
              <p className="mt-1 text-sm text-muted">`id` 必须与 Excel 中 `分类专项id` 一致。</p>
            </div>
            {selectedSpecial ? <Button variant="ghost" onClick={resetForm}>切换新增</Button> : null}
          </div>

          <div className="mt-5 space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">专项 ID</span>
              <Input
                value={form.id}
                disabled={Boolean(selectedSpecial)}
                onChange={(event) => setForm((prev) => ({ ...prev, id: event.target.value }))}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">所属一级分类</span>
              <Select
                value={form.categoryId}
                onChange={(event) => setForm((prev) => ({ ...prev, categoryId: event.target.value }))}
              >
                <option value="">请选择一级分类</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </Select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">专项名称</span>
              <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
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

          <div className="mt-5 flex flex-wrap gap-2">
            <Button className="flex-1" onClick={() => void handleSubmit()} disabled={saving}>
              {saving ? '保存中...' : selectedSpecial ? '保存修改' : '创建专项'}
            </Button>
            {selectedSpecial ? (
              <Link href={`/admin/campus-exam/specials/${selectedSpecial.id}`} className="flex-1">
                <Button className="w-full" variant="secondary">进入详情</Button>
              </Link>
            ) : null}
          </div>
        </Card>
      </section>
    </div>
  );
}
