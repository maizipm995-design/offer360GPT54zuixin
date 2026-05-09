'use client';

import { useEffect, useMemo, useState } from 'react';
import { Upload, LoaderCircle } from 'lucide-react';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { AdminTable } from '@/components/admin/admin-table';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { buildQuery } from '@/lib/admin';
import { clientFetch } from '@/lib/api';
import { requestAdminOssUploadSession, uploadFileToOss } from '@/lib/oss';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useGlobalToast } from '@/store/toast-store';
import { AdminListResponse, AdminServiceProductItem } from '@/types';

const initialFilters = {
  keyword: '',
  status: '',
  hot: '',
};

const emptyForm = {
  name: '',
  description: '',
  price: '1',
  originalPrice: '199',
  score: '4.8',
  salesCount: '0',
  isHot: 'true',
  status: 'true',
  detailHtml: '',
  detailPreviewHtml: '',
  orderServiceText: '',
  orderServiceImageUrl: '',
  orderServiceImagePreviewUrl: '',
};

export default function AdminServiceProductsPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState<AdminListResponse<AdminServiceProductItem>>({
    list: [],
    pagination: { page: 1, limit: 10, total: 0, hasMore: false },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingDetailImage, setUploadingDetailImage] = useState(false);
  const [uploadingOrderGuideImage, setUploadingOrderGuideImage] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(emptyForm);

  useGlobalToast(message, setMessage);

  const selectedItem = useMemo(() => data.list.find((item) => item.id === selectedId) ?? null, [data.list, selectedId]);

  const loadData = async (page = 1, nextFilters = filters) => {
    try {
      setLoading(true);
      const result = await clientFetch<AdminListResponse<AdminServiceProductItem>>(`/admin/service-products?${buildQuery({ ...nextFilters, page, limit: 10 })}`);
      setData(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '服务商品加载失败');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void loadData(1, filters);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fillForm = (item: AdminServiceProductItem) => {
    setSelectedId(item.id);
    setForm({
      name: item.name,
      description: item.description,
      price: String(item.price),
      originalPrice: String(item.originalPrice),
      score: String(item.score),
      salesCount: String(item.salesCount),
      isHot: String(item.isHot),
      status: String(item.status),
      detailHtml: item.detailHtml || '',
      detailPreviewHtml: item.detailPreviewHtml || item.detailHtml || '',
      orderServiceText: item.orderServiceText || '',
      orderServiceImageUrl: item.orderServiceImageUrl || '',
      orderServiceImagePreviewUrl: item.orderServiceImagePreviewUrl || item.orderServiceImageUrl || '',
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
        name: form.name,
        description: form.description,
        price: Number(form.price),
        originalPrice: Number(form.originalPrice),
        score: Number(form.score),
        salesCount: Number(form.salesCount),
        isHot: form.isHot === 'true',
        status: form.status === 'true',
        detailHtml: form.detailHtml,
        orderServiceText: form.orderServiceText,
        orderServiceImageUrl: form.orderServiceImageUrl,
      };
      const result = selectedId
        ? await clientFetch<AdminServiceProductItem>(`/admin/service-products/${selectedId}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await clientFetch<AdminServiceProductItem>('/admin/service-products', { method: 'POST', body: JSON.stringify(payload) });
      setMessage(selectedId ? '服务商品已更新' : '服务商品已创建');
      fillForm(result);
      await loadData(1, filters);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '服务商品保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!window.confirm('确认删除当前服务商品吗？')) return;
    try {
      await clientFetch(`/admin/service-products/${selectedId}`, { method: 'DELETE' });
      setMessage('服务商品已删除');
      resetForm();
      await loadData(1, filters);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '服务商品删除失败');
    }
  };

  const handleUploadDetailImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    try {
      setUploadingDetailImage(true);
      const session = await requestAdminOssUploadSession({
        scene: 'service-product-detail-image',
        file,
        bizId: selectedId || undefined,
      });
      const uploaded = await uploadFileToOss(session, file);
      setForm((prev) => ({
        ...prev,
        detailHtml: appendHtmlImage(prev.detailHtml, uploaded.objectReference, file.name),
        detailPreviewHtml: appendHtmlImage(prev.detailPreviewHtml || prev.detailHtml, uploaded.signedUrl || uploaded.objectReference, file.name),
      }));
      setMessage('详情图片已上传并插入 HTML');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '详情图片上传失败');
    } finally {
      setUploadingDetailImage(false);
    }
  };

  const handleUploadOrderGuideImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    try {
      setUploadingOrderGuideImage(true);
      const session = await requestAdminOssUploadSession({
        scene: 'service-product-order-image',
        file,
        bizId: selectedId || undefined,
      });
      const uploaded = await uploadFileToOss(session, file);
      setForm((prev) => ({
        ...prev,
        orderServiceImageUrl: uploaded.objectReference,
        orderServiceImagePreviewUrl: uploaded.signedUrl || uploaded.objectReference,
      }));
      setMessage('订单服务配图已上传');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '订单服务配图上传失败');
    } finally {
      setUploadingOrderGuideImage(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Admin service products</p>
        <div className="mt-2 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-ink">服务商品管理</h2>
            <p className="mt-2 text-sm text-muted">支持服务商品的新增、编辑、副标题、HTML 详情介绍与订单服务弹窗配置。</p>
          </div>
          <Button onClick={resetForm}>新增商品</Button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_460px]">
        <div className="space-y-4">
          <Card className="rounded-3xl p-4">
            <div className="grid gap-3 md:grid-cols-4">
              <Input placeholder="搜索服务名称 / 副标题" value={filters.keyword} onChange={(e) => setFilters((prev) => ({ ...prev, keyword: e.target.value }))} />
              <Select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
                <option value="">全部状态</option>
                <option value="active">上架</option>
                <option value="inactive">下架</option>
              </Select>
              <Select value={filters.hot} onChange={(e) => setFilters((prev) => ({ ...prev, hot: e.target.value }))}>
                <option value="">全部热销状态</option>
                <option value="hot">仅看热销</option>
              </Select>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => void loadData(1, filters)}>搜索</Button>
                <Button className="flex-1" variant="secondary" onClick={() => { setFilters(initialFilters); resetForm(); void loadData(1, initialFilters); }}>重置</Button>
              </div>
            </div>
          </Card>

          <AdminTable headers={['服务名称', '现价', '评分', '销量', '状态', '更新时间']} hasData={data.list.length > 0} emptyText={loading ? '服务商品加载中...' : '暂无商品数据'}>
            {data.list.map((item) => (
              <tr
                key={item.id}
                className={`cursor-pointer border-b border-slate-100 last:border-b-0 ${selectedId === item.id ? 'bg-brand/5' : 'hover:bg-slate-50'}`}
                onClick={() => fillForm(item)}
              >
                <td className="px-4 py-3 font-medium text-ink">{item.name}</td>
                <td className="px-4 py-3 text-slate-600">{formatCurrency(item.price)}</td>
                <td className="px-4 py-3 text-slate-600">{item.score}</td>
                <td className="px-4 py-3 text-slate-600">{item.salesCount}</td>
                <td className="px-4 py-3 text-slate-600">{item.status ? (item.isHot ? '上架·热销' : '上架') : '下架'}</td>
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

        <Card className="rounded-3xl p-5 xl:sticky xl:top-6 xl:max-h-[calc(100vh-48px)] xl:self-start xl:overflow-y-auto">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-ink">{selectedItem ? '编辑商品' : '新增商品'}</h3>
              <p className="mt-1 text-sm text-muted">这里维护商品副标题、HTML 详情介绍以及订单成功后的服务弹窗内容。</p>
            </div>
            {selectedItem ? <Button variant="ghost" onClick={resetForm}>切换新增</Button> : null}
          </div>

          <div className="mt-5 space-y-4">
            <Input placeholder="商品名称" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
            <Textarea placeholder="副标题 / 列表摘要" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} className="min-h-[96px]" />
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" step="0.01" placeholder="现价" value={form.price} onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))} />
              <Input type="number" step="0.01" placeholder="原价" value={form.originalPrice} onChange={(e) => setForm((prev) => ({ ...prev, originalPrice: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" step="0.1" placeholder="评分" value={form.score} onChange={(e) => setForm((prev) => ({ ...prev, score: e.target.value }))} />
              <Input type="number" placeholder="付款人数" value={form.salesCount} onChange={(e) => setForm((prev) => ({ ...prev, salesCount: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select value={form.isHot} onChange={(e) => setForm((prev) => ({ ...prev, isHot: e.target.value }))}>
                <option value="true">热销商品</option>
                <option value="false">普通商品</option>
              </Select>
              <Select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
                <option value="true">上架</option>
                <option value="false">下架</option>
              </Select>
            </div>
            <Textarea
              placeholder="商品详情介绍 HTML（支持图文、自定义排版和样式）"
              value={form.detailHtml}
              onChange={(e) => setForm((prev) => ({ ...prev, detailHtml: e.target.value, detailPreviewHtml: e.target.value }))}
              className="min-h-[220px] font-mono text-xs"
            />
            <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed border-[#D1D5DB] bg-white px-3 py-2 text-sm text-slate-600 transition hover:border-brand hover:bg-brand/10 hover:text-brand">
              {uploadingDetailImage ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span>{uploadingDetailImage ? '上传中...' : '上传详情图片并插入 HTML'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(event) => void handleUploadDetailImage(event)} />
            </label>
            <Textarea
              placeholder="订单服务弹窗说明文字"
              value={form.orderServiceText}
              onChange={(e) => setForm((prev) => ({ ...prev, orderServiceText: e.target.value }))}
              className="min-h-[140px]"
            />
            <Input
              placeholder="订单服务弹窗配图对象引用（可选）"
              value={form.orderServiceImageUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, orderServiceImageUrl: e.target.value, orderServiceImagePreviewUrl: e.target.value }))}
            />
            <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed border-[#D1D5DB] bg-white px-3 py-2 text-sm text-slate-600 transition hover:border-brand hover:bg-brand/10 hover:text-brand">
              {uploadingOrderGuideImage ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span>{uploadingOrderGuideImage ? '上传中...' : '上传订单服务配图'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(event) => void handleUploadOrderGuideImage(event)} />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button className="flex-1" onClick={handleSubmit} disabled={saving}>{saving ? '保存中...' : '保存商品'}</Button>
            {selectedItem ? <Button className="flex-1" variant="secondary" onClick={handleDelete}>删除商品</Button> : null}
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-sm font-semibold text-ink">商品详情预览</p>
            {form.detailHtml ? (
              <div
                className="service-rich-content text-sm text-slate-700 [&_a]:text-brand [&_a]:underline [&_img]:my-4 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-2xl [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p+p]:mt-3 [&_ul]:list-disc [&_ul]:pl-5"
                dangerouslySetInnerHTML={{ __html: form.detailPreviewHtml || selectedItem?.detailPreviewHtml || form.detailHtml }}
              />
            ) : (
              <p className="text-sm leading-7 text-muted">{form.description || '请输入 HTML 商品详情后在这里预览。'}</p>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-ink">订单服务弹窗预览</p>
            <div className={`mt-4 ${(form.orderServiceImagePreviewUrl || selectedItem?.orderServiceImagePreviewUrl || form.orderServiceImageUrl) ? 'grid gap-4 lg:grid-cols-[1.1fr_0.9fr]' : ''}`}>
              <div className="rounded-2xl bg-white p-4">
                <p className="whitespace-pre-line text-sm leading-7 text-slate-600">{form.orderServiceText || '请输入订单服务弹窗说明文字。'}</p>
              </div>
              {(form.orderServiceImagePreviewUrl || selectedItem?.orderServiceImagePreviewUrl || form.orderServiceImageUrl) ? (
                <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.orderServiceImagePreviewUrl || selectedItem?.orderServiceImagePreviewUrl || form.orderServiceImageUrl} alt="订单服务弹窗配图预览" className="h-full w-full object-cover" />
                </div>
              ) : null}
            </div>
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
