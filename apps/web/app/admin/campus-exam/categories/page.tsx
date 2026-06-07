'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AdminModal } from '@/components/admin/admin-modal';
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
  CampusExamAdminCategoryDeleteResult,
  CampusExamAdminCategoryFolderImportResult,
  CampusExamListResponse,
} from '@/lib/campus-exam';
import { buildQuery } from '@/lib/admin';
import { clientFetch, clientUpload } from '@/lib/api';
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

const MAX_IMPORT_FILE_SIZE = 20 * 1024 * 1024;
const EXCEL_FILE_PATTERN = /\.(xlsx|xls)$/i;

type DirectoryUploadFile = File & {
  webkitRelativePath?: string;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getFolderImportStatusMeta(status: CampusExamAdminCategoryFolderImportResult['fileResults'][number]['status']) {
  switch (status) {
    case 'imported':
      return {
        label: '导入完成',
        className: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      };
    case 'skipped_existing_special':
      return {
        label: '专项已存在',
        className: 'bg-amber-50 text-amber-700 border border-amber-200',
      };
    case 'skipped_invalid_file':
      return {
        label: '文件已跳过',
        className: 'bg-slate-100 text-slate-700 border border-slate-200',
      };
    case 'skipped_invalid_template':
      return {
        label: '模板不匹配',
        className: 'bg-orange-50 text-orange-700 border border-orange-200',
      };
    case 'failed':
    default:
      return {
        label: '导入失败',
        className: 'bg-rose-50 text-rose-700 border border-rose-200',
      };
  }
}

function buildFolderImportReportSummary(item: CampusExamAdminCategoryFolderImportResult['fileResults'][number]) {
  const normalizedMessage = item.message.replace(/[。；，,]+$/u, '');
  if (item.status === 'imported') {
    return `${normalizedMessage}；共检测 ${item.totalCount} 行，成功导入 ${item.importedCount} 题，跳过 ${item.skippedCount} 题，失败 ${item.failedCount} 题`;
  }
  const availableCount = item.importedCount + item.skippedCount + item.failedCount;
  return `${normalizedMessage}；共检测 ${item.totalCount} 行，可导入 ${availableCount} 题`;
}

export default function CampusExamAdminCategoriesPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState<CampusExamListResponse<CampusExamAdminCategory>>({
    list: [],
    pagination: { page: 1, limit: 10, total: 0, hasMore: false },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [folderFiles, setFolderFiles] = useState<DirectoryUploadFile[]>([]);
  const [folderImporting, setFolderImporting] = useState(false);
  const [folderImportResult, setFolderImportResult] = useState<CampusExamAdminCategoryFolderImportResult | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    const input = folderInputRef.current;
    if (!input) {
      return;
    }
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
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

  const openCreateModal = () => {
    resetForm();
    setEditorOpen(true);
  };

  const openEditModal = (item: CampusExamAdminCategory) => {
    handleSelect(item);
    setEditorOpen(true);
  };

  const closeEditorModal = () => {
    setEditorOpen(false);
  };

  const resetForm = () => {
    setSelectedId('');
    setForm(emptyForm);
  };

  const openFolderPicker = () => {
    const input = folderInputRef.current;
    if (!input) {
      setMessage('文件夹选择器初始化失败，请刷新页面后重试');
      return;
    }
    input.value = '';
    try {
      if (typeof input.showPicker === 'function') {
        input.showPicker();
        return;
      }
    } catch {
      // 回退到 click，兼容不支持或受限的浏览器环境
    }
    input.click();
  };

  const handleFolderChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []) as DirectoryUploadFile[];
    if (!files.length) {
      setFolderFiles([]);
      return;
    }

    const folderNames = Array.from(new Set(files.map((file) => (file.webkitRelativePath || file.name).split('/').filter(Boolean)[0] || '')));
    if (folderNames.length !== 1 || !folderNames[0]) {
      setMessage('一次只能选择 1 个一级分类文件夹');
      event.target.value = '';
      setFolderFiles([]);
      return;
    }

    const skippedStats = {
      system: 0,
      nonTable: 0,
      oversized: 0,
      nested: 0,
    };
    const validFiles = files.filter((file) => {
      const relativePath = file.webkitRelativePath || file.name;
      const segments = relativePath.split('/').filter(Boolean);
      const fileName = segments[1] || file.name;
      if (segments.length !== 2) {
        skippedStats.nested += 1;
        return false;
      }
      if (/^\.DS_Store$/i.test(fileName)) {
        skippedStats.system += 1;
        return false;
      }
      if (!EXCEL_FILE_PATTERN.test(fileName)) {
        skippedStats.nonTable += 1;
        return false;
      }
      if (file.size > MAX_IMPORT_FILE_SIZE) {
        skippedStats.oversized += 1;
        return false;
      }
      return true;
    });

    const skippedCount = skippedStats.system + skippedStats.nonTable + skippedStats.oversized + skippedStats.nested;
    const skippedReasons = [
      skippedStats.system ? `.DS_Store ${skippedStats.system} 个` : '',
      skippedStats.nonTable ? `非表格 ${skippedStats.nonTable} 个` : '',
      skippedStats.oversized ? `超限文件 ${skippedStats.oversized} 个` : '',
      skippedStats.nested ? `非标准目录 ${skippedStats.nested} 个` : '',
    ].filter(Boolean);

    if (!validFiles.length) {
      setFolderFiles([]);
      setFolderImportResult(null);
      setMessage(
        skippedCount
          ? `文件夹 ${folderNames[0]} 中没有可上传的有效表格文件，已自动跳过：${skippedReasons.join('、')}`
          : `文件夹 ${folderNames[0]} 中没有可上传的有效表格文件`,
      );
      event.target.value = '';
      return;
    }

    setFolderFiles(validFiles);
    setFolderImportResult(null);
    setMessage(
      skippedCount
        ? `已选择文件夹 ${folderNames[0]}，可处理 ${validFiles.length} 个表格文件，自动跳过 ${skippedCount} 个无效文件（${skippedReasons.join('、')}）`
        : `已选择文件夹 ${folderNames[0]}，共 ${validFiles.length} 个表格文件`,
    );
  };

  const handleFolderImport = async () => {
    if (!folderFiles.length) {
      setMessage('请先选择一级分类文件夹');
      return;
    }
    try {
      setFolderImporting(true);
      setMessage('正在上传文件夹并批量导入，请稍候...');
      const formData = new FormData();
      folderFiles.forEach((file) => {
        formData.append('files', file);
        formData.append('relativePaths', file.webkitRelativePath || file.name);
      });
      const result = await clientUpload<CampusExamAdminCategoryFolderImportResult>(
        '/admin/campus-exam/categories/import-folder',
        formData,
      );
      setFolderImportResult(result);
      setMessage(`批量上传完成：一级分类“${result.categoryName}”已处理`);
      await loadData(1, filters);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '文件夹批量上传失败');
    } finally {
      setFolderImporting(false);
    }
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

  const handleDelete = async () => {
    if (!selectedCategory) {
      setMessage('请先选择要删除的一级分类');
      return;
    }
    const confirmed = window.confirm(
      `确认删除一级分类“${selectedCategory.name}”吗？\n\n删除后将级联清空该分类下全部二级分类及其所有试题数据，且无法恢复。`,
    );
    if (!confirmed) {
      return;
    }

    try {
      setDeleting(true);
      const result = await clientFetch<CampusExamAdminCategoryDeleteResult>(
        `/admin/campus-exam/categories/${selectedCategory.id}`,
        { method: 'DELETE' },
      );
      setMessage(`一级分类已删除：同步删除 ${result.deletedSpecialCount} 个二级分类、${result.deletedQuestionCount} 道试题`);
      resetForm();
      closeEditorModal();
      await loadData(1, filters);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '一级分类删除失败');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Campus exam admin</p>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-ink">校招笔试一级分类管理</h2>
            <p className="mt-2 text-sm text-muted">维护分类名称、随机专项业务ID、slug、状态与排序，同时为二级专项和导入入口提供上游结构。</p>
          </div>
          <Button onClick={openCreateModal}>新增一级分类</Button>
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

      <Card className="rounded-3xl p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <h3 className="text-xl font-semibold text-ink">文件夹批量上传</h3>
            <p className="mt-2 text-sm text-slate-500">
              选择本地一级分类文件夹后，系统会按顶层文件夹名映射一级分类、按文件名映射二级分类，并把每个 Excel 内的题目导入对应二级分类。
            </p>
            <p className="mt-2 text-xs text-slate-500">
              目录结构仅支持 `一级分类文件夹/题库文件.xlsx`；若已存在同名一级分类、二级分类或重复题目，会自动跳过不重复入库。
            </p>
            <p className="mt-1 text-xs text-slate-500">
              仅支持文件夹上传，不支持单个文件上传；`.DS_Store`、非表格文件、超限文件和非标准目录文件会自动跳过。
            </p>
            <p className="mt-1 text-xs text-slate-500">
              仅解析 `.xlsx / .xls` 且字段完全匹配标准模板的表格，异常表格会自动跳过；单文件上限 {formatFileSize(MAX_IMPORT_FILE_SIZE)}。
            </p>
          </div>
          <div className="w-full max-w-md rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-medium text-ink">当前选择</p>
            <p className="mt-2 break-all">
              {folderFiles.length
                ? `${(folderFiles[0]?.webkitRelativePath || '').split('/').filter(Boolean)[0]} (${folderFiles.length} 个文件)`
                : '尚未选择文件夹'}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {folderFiles.length
                ? folderFiles.map((file) => file.name).slice(0, 3).join('、')
                : '建议文件名直接使用要创建的二级分类名称'}
              {folderFiles.length > 3 ? ' 等' : ''}
            </p>
          </div>
        </div>
        <input
          ref={folderInputRef}
          type="file"
          multiple
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="sr-only"
          onChange={handleFolderChange}
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={openFolderPicker} disabled={folderImporting || saving}>
            {folderFiles.length ? '重新选择文件夹' : '选择一级分类文件夹'}
          </Button>
          <Button onClick={() => void handleFolderImport()} disabled={!folderFiles.length || folderImporting || saving}>
            {folderImporting ? '批量上传中...' : '开始批量上传'}
          </Button>
        </div>
      </Card>

      {message ? (
        <Card className="p-4 text-sm text-slate-600">{message}</Card>
      ) : null}

      {folderImportResult ? (
        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="p-5">
            <h3 className="text-xl font-semibold text-ink">批量上传结果</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">一级分类</p>
                <p className="mt-2 text-lg font-semibold text-ink">{folderImportResult.categoryName}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {folderImportResult.categoryStatus === 'created'
                    ? '本次新建'
                    : folderImportResult.categoryStatus === 'reused'
                      ? '复用已有分类'
                      : '本次未创建分类'}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">处理文件数</p>
                <p className="mt-2 text-lg font-semibold text-ink">{folderImportResult.totalFileCount}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">无效文件跳过</p>
                <p className="mt-2 text-lg font-semibold text-ink">{folderImportResult.skippedFileCount}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">二级分类新增 / 跳过</p>
                <p className="mt-2 text-lg font-semibold text-ink">
                  {folderImportResult.createdSpecialCount} / {folderImportResult.skippedSpecialCount}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">题目导入 / 跳过 / 失败</p>
                <p className="mt-2 text-lg font-semibold text-ink">
                  {folderImportResult.importedQuestionCount} / {folderImportResult.skippedQuestionCount} / {folderImportResult.failedQuestionCount}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-xl font-semibold text-ink">文件处理明细</h3>
            <div className="mt-4 space-y-3">
              {folderImportResult.fileResults.map((item) => (
                <div key={item.relativePath} className="rounded-2xl border border-slate-200 p-4">
                  {(() => {
                    const statusMeta = getFolderImportStatusMeta(item.status);
                    return (
                      <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink">{item.fileName}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.specialName}</p>
                    </div>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusMeta.className}`}>
                      {statusMeta.label}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{buildFolderImportReportSummary(item)}</p>
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          </Card>
        </section>
      ) : null}

      <section className="space-y-4">
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
          headers={['分类名称', '专项业务ID', 'Slug', '专项数', '状态', '排序', '更新时间']}
          hasData={data.list.length > 0}
          emptyText={loading ? '一级分类加载中...' : '暂无一级分类'}
        >
          {data.list.map((item) => (
            <tr
              key={item.id}
              className={`cursor-pointer border-b border-slate-100 last:border-b-0 ${selectedId === item.id ? 'bg-brand/5' : 'hover:bg-slate-50'}`}
              onClick={() => openEditModal(item)}
            >
              <td className="px-4 py-3 font-medium text-ink">{item.name}</td>
              <td className="px-4 py-3 font-mono text-slate-600">{item.specialCode}</td>
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
      </section>

      <AdminModal
        open={editorOpen}
        title={selectedCategory ? '编辑一级分类' : '新增一级分类'}
        description="专项业务ID由系统自动生成；`slug` 不填则按名称自动生成，建议保持简短稳定。"
        onClose={closeEditorModal}
      >
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-muted">分类维护改为弹窗编辑，主页面专注展示目录结构和批量导入能力。</div>
            {selectedCategory ? <Button variant="ghost" onClick={openCreateModal}>切换新增</Button> : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">专项业务ID</span>
              <Input value={selectedCategory?.specialCode ?? '创建后自动生成'} disabled />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">分类名称</span>
              <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            </label>
            <label className="block space-y-2 lg:col-span-2">
              <span className="text-sm font-medium text-ink">Slug</span>
              <Input value={form.slug} onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))} />
            </label>
            <label className="block space-y-2 lg:col-span-2">
              <span className="text-sm font-medium text-ink">描述</span>
              <Textarea
                className="min-h-[120px]"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </label>
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

          <div className="flex flex-wrap justify-end gap-2">
            {selectedCategory ? (
              <Button variant="secondary" onClick={() => void handleDelete()} disabled={saving || deleting}>
                {deleting ? '删除中...' : '删除分类'}
              </Button>
            ) : null}
            <Button variant="secondary" onClick={closeEditorModal}>取消</Button>
            <Button onClick={() => void handleSubmit()} disabled={saving}>
              {saving ? '保存中...' : selectedCategory ? '保存修改' : '创建分类'}
            </Button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
