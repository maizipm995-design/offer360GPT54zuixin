'use client';

import { useEffect, useMemo, useState } from 'react';
import { LoaderCircle, Upload } from 'lucide-react';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { AdminTable } from '@/components/admin/admin-table';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { buildQuery } from '@/lib/admin';
import { clientFetch } from '@/lib/api';
import { requestAdminOssUploadSession, uploadFileToOss } from '@/lib/oss';
import { formatDate } from '@/lib/utils';
import { useGlobalToast } from '@/store/toast-store';
import { AdminListResponse, AdminMembershipContentItem } from '@/types';

const initialFilters = {
  keyword: '',
};

const emptyForm = {
  slug: '',
  title: '',
  htmlContent: '',
  previewHtml: '',
};

export default function AdminMembershipContentPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState<AdminListResponse<AdminMembershipContentItem>>({
    list: [],
    pagination: { page: 1, limit: 10, total: 0, hasMore: false },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(emptyForm);

  useGlobalToast(message, setMessage);

  const selectedItem = useMemo(() => data.list.find((item) => item.id === selectedId) ?? null, [data.list, selectedId]);

  const loadData = async (page = 1, nextFilters = filters) => {
    try {
      setLoading(true);
      const result = await clientFetch<AdminListResponse<AdminMembershipContentItem>>(`/admin/membership-contents?${buildQuery({ ...nextFilters, page, limit: 10 })}`);
      setData(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '会员权益内容加载失败');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void loadData(1, filters);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fillForm = (item: AdminMembershipContentItem) => {
    setSelectedId(item.id);
    setForm({
      slug: item.slug,
      title: item.title,
      htmlContent: item.htmlContent,
      previewHtml: item.previewHtml || item.htmlContent,
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
        slug: form.slug,
        title: form.title,
        htmlContent: form.htmlContent,
      };
      const result = selectedId
        ? await clientFetch<AdminMembershipContentItem>(`/admin/membership-contents/${selectedId}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await clientFetch<AdminMembershipContentItem>('/admin/membership-contents', { method: 'POST', body: JSON.stringify(payload) });
      setMessage(selectedId ? '会员权益内容已更新' : '会员权益内容已创建');
      fillForm(result);
      await loadData(1, filters);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '会员权益内容保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    try {
      setUploadingImage(true);
      const session = await requestAdminOssUploadSession({
        scene: 'membership-content-image',
        file,
        bizId: selectedId || form.slug || undefined,
      });
      const uploaded = await uploadFileToOss(session, file);
      setForm((prev) => ({
        ...prev,
        htmlContent: appendHtmlImage(prev.htmlContent, uploaded.objectReference, file.name),
        previewHtml: appendHtmlImage(prev.previewHtml || prev.htmlContent, uploaded.signedUrl || uploaded.objectReference, file.name),
      }));
      setMessage('会员权益图片已上传并插入 HTML');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '会员权益图片上传失败');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!window.confirm('确认删除当前内容吗？')) return;
    try {
      await clientFetch(`/admin/membership-contents/${selectedId}`, { method: 'DELETE' });
      setMessage('会员权益内容已删除');
      resetForm();
      await loadData(1, filters);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '会员权益内容删除失败');
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Admin membership content</p>
        <div className="mt-2 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-ink">会员权益内容管理</h2>
            <p className="mt-2 text-sm text-muted">维护会员开通页的富文本内容，支持多条内容按 slug 管理并实时预览。</p>
          </div>
          <Button onClick={resetForm}>新增内容</Button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <Card className="rounded-3xl p-4">
            <div className="flex gap-2">
              <Input placeholder="搜索 slug / 标题" value={filters.keyword} onChange={(e) => setFilters({ keyword: e.target.value })} />
              <Button onClick={() => void loadData(1, filters)}>搜索</Button>
            </div>
          </Card>

          <AdminTable headers={['标题', 'slug', '更新时间']} hasData={data.list.length > 0} emptyText={loading ? '会员权益内容加载中...' : '暂无内容数据'}>
            {data.list.map((item) => (
              <tr
                key={item.id}
                className={`cursor-pointer border-b border-slate-100 last:border-b-0 ${selectedId === item.id ? 'bg-brand/5' : 'hover:bg-slate-50'}`}
                onClick={() => fillForm(item)}
              >
                <td className="px-4 py-3 font-medium text-ink">{item.title}</td>
                <td className="px-4 py-3 text-slate-600">{item.slug}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(item.updatedAt)}</td>
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
              <h3 className="text-xl font-semibold text-ink">{selectedItem ? '编辑内容' : '新增内容'}</h3>
              <p className="mt-1 text-sm text-muted">推荐使用结构化 HTML，便于前端稳定渲染样式。</p>
            </div>
            {selectedItem ? <Button variant="ghost" onClick={resetForm}>切换新增</Button> : null}
          </div>

          <div className="mt-5 space-y-4">
            <Input placeholder="slug" value={form.slug} onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))} />
            <Input placeholder="标题" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
            <Textarea placeholder="HTML 富文本内容" value={form.htmlContent} onChange={(e) => setForm((prev) => ({ ...prev, htmlContent: e.target.value, previewHtml: e.target.value }))} className="min-h-[220px] font-mono text-xs" />
            <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed border-[#D1D5DB] bg-white px-3 py-2 text-sm text-slate-600 transition hover:border-brand hover:bg-brand/10 hover:text-brand">
              {uploadingImage ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span>{uploadingImage ? '上传中...' : '上传图片并插入 HTML'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(event) => void handleUploadImage(event)} />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button className="flex-1" onClick={handleSubmit} disabled={saving}>{saving ? '保存中...' : '保存内容'}</Button>
            {selectedItem ? <Button className="flex-1" variant="secondary" onClick={handleDelete}>删除内容</Button> : null}
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-sm font-semibold text-ink">内容预览</p>
            <div className="membership-rich-content text-sm" dangerouslySetInnerHTML={{ __html: form.previewHtml || form.htmlContent || '<p>请输入 HTML 富文本内容</p>' }} />
          </div>
        </Card>
      </section>
    </div>
  );
}

function appendHtmlImage(html: string, src: string, alt: string) {
  const imageBlock = `\n<p><img src="${src}" alt="${escapeHtmlAttribute(alt)}" /></p>`;
  return `${html.trim()}${imageBlock}`.trim();
}

function escapeHtmlAttribute(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
