'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { DEGREE_OPTIONS, ENTERPRISE_NATURE_OPTIONS, JOB_TYPE_OPTIONS } from '@offer360/shared';
import { AdminModal } from '@/components/admin/admin-modal';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { AdminTable } from '@/components/admin/admin-table';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { buildQuery, downloadFilePayload } from '@/lib/admin';
import { clientFetch, clientUpload, type ClientUploadProgress } from '@/lib/api';
import { ADMIN_TOAST_COPY } from '@/lib/toast-copy';
import { formatDate } from '@/lib/utils';
import { useGlobalToast } from '@/store/toast-store';
import { AdminFileDownloadPayload, AdminImportResult, AdminJobItem, AdminListResponse } from '@/types';

const initialFilters = {
  keyword: '',
  enterpriseNature: '',
  jobType: '',
};

const jobTemplateHeaders = [
  '企业/单位全称',
  '企业性质',
  '学历要求',
  '工作地点',
  '岗位名称',
  '专业需求',
  '招聘类型',
  '截止日期',
  '公告链接',
  '投递链接',
  '毕业届别',
  '内推码',
  '招聘公告标题',
  '行业',
  '录入日期',
] as const;

const emptyForm = {
  companyFullName: '',
  enterpriseNature: '',
  degreeRequirement: '',
  workLocation: '',
  jobName: '',
  majorRequirement: '',
  recruitmentType: '',
  deadlineAt: '',
  announcementUrl: '',
  deliveryUrl: '',
  graduationSession: '',
  referralCode: '',
  announcementTitle: '',
  industry: '',
  entryDate: '',
};

const MAX_JOB_IMPORT_FILE_SIZE = 50 * 1024 * 1024;

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function AdminJobsPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState<AdminListResponse<AdminJobItem>>({
    list: [],
    pagination: { page: 1, limit: 10, total: 0, hasMore: false },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatusText, setImportStatusText] = useState('请选择 Excel 文件后开始导入');
  const [importResult, setImportResult] = useState<AdminImportResult | null>(null);

  useGlobalToast(message, setMessage);

  const importInputRef = useRef<HTMLInputElement | null>(null);
  const page = data.pagination.page || 1;

  const loadData = async (nextPage = page, nextFilters = filters) => {
    try {
      setLoading(true);
      const queryString = buildQuery({ ...nextFilters, page: nextPage, limit: 10 });
      const result = await clientFetch<AdminListResponse<AdminJobItem>>(`/admin/jobs?${queryString}`);
      setData(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.loadFailed('招聘公告'));
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void loadData(1, filters);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedJob = useMemo(() => data.list.find((item) => item.id === selectedId) ?? null, [data.list, selectedId]);

  const handleSelect = (item: AdminJobItem) => {
    setSelectedId(item.id);
    setForm({
      companyFullName: item.companyFullName,
      enterpriseNature: item.enterpriseNature || '',
      degreeRequirement: item.degreeRequirement || '',
      workLocation: item.workLocation || '',
      jobName: item.jobName || '',
      majorRequirement: item.majorRequirement || '',
      recruitmentType: item.recruitmentType || '',
      deadlineAt: item.deadlineAt || '',
      announcementUrl: item.announcementUrl || '',
      deliveryUrl: item.deliveryUrl || '',
      graduationSession: item.graduationSession || '',
      referralCode: item.referralCode || '',
      announcementTitle: item.announcementTitle || '',
      industry: item.industry || '',
      entryDate: item.entryDate || '',
    });
  };

  const openCreateModal = () => {
    resetForm();
    setEditorOpen(true);
  };

  const openEditModal = (item: AdminJobItem) => {
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

  const clearImportSelection = () => {
    setImportFile(null);
    setImportProgress(0);
    setImportStatusText('请选择 Excel 文件后开始导入');
    if (importInputRef.current) {
      importInputRef.current.value = '';
    }
  };

  const handleReset = async () => {
    setFilters(initialFilters);
    resetForm();
    await loadData(1, initialFilters);
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      const payload = { ...form };
      const result = selectedId
        ? await clientFetch<AdminJobItem>(`/admin/jobs/${selectedId}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await clientFetch<AdminJobItem>('/admin/jobs', { method: 'POST', body: JSON.stringify(payload) });
      setMessage(selectedId ? ADMIN_TOAST_COPY.updated('招聘公告') : ADMIN_TOAST_COPY.created('招聘公告'));
      handleSelect(result);
      await loadData(selectedId ? page : 1, filters);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.saveFailed('招聘公告'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!window.confirm('确认删除当前招聘公告吗？')) return;
    try {
      await clientFetch(`/admin/jobs/${selectedId}`, { method: 'DELETE' });
      setMessage(ADMIN_TOAST_COPY.deleted('招聘公告'));
      resetForm();
      closeEditorModal();
      await loadData(1, filters);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.deleteFailed('招聘公告'));
    }
  };

  const handleTemplateDownload = async () => {
    try {
      setDownloadingTemplate(true);
      const payload = await clientFetch<AdminFileDownloadPayload>('/admin/jobs/template');
      downloadFilePayload(payload);
      setMessage(ADMIN_TOAST_COPY.templateDownloaded('招聘公告导入'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.exportFailed('模板'));
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const queryString = buildQuery(filters);
      const payload = await clientFetch<AdminFileDownloadPayload>(`/admin/jobs/export${queryString ? `?${queryString}` : ''}`);
      downloadFilePayload(payload);
      setMessage(ADMIN_TOAST_COPY.exportDone('招聘公告筛选结果'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.exportFailed('招聘公告'));
    } finally {
      setExporting(false);
    }
  };

  const handleImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      clearImportSelection();
      return;
    }

    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      clearImportSelection();
      setMessage('请上传 .xlsx 或 .xls 格式的 Excel 文件');
      return;
    }

    if (file.size > MAX_JOB_IMPORT_FILE_SIZE) {
      clearImportSelection();
      setMessage(`Excel 文件不能超过 ${formatFileSize(MAX_JOB_IMPORT_FILE_SIZE)}`);
      return;
    }

    setImportFile(file);
    setImportProgress(0);
    setImportResult(null);
    setImportStatusText(`已选择 ${file.name}（${formatFileSize(file.size)}），点击“开始导入”后将自动上传并分批入库。`);
    setMessage(ADMIN_TOAST_COPY.fileSelected(file.name));
  };

  const handleImportProgress = (progress: ClientUploadProgress) => {
    if (progress.phase === 'uploading') {
      setImportProgress(progress.percent);
      const progressText = progress.total > 0
        ? `${formatFileSize(progress.loaded)} / ${formatFileSize(progress.total)}`
        : '正在上传文件';
      setImportStatusText(`正在上传文件：${progressText}`);
      return;
    }

    if (progress.phase === 'processing') {
      setImportProgress((current) => (current < progress.percent ? progress.percent : current));
      setImportStatusText('文件上传完成，服务端正在解析并分批入库，请稍候...');
      return;
    }

    setImportProgress(100);
    setImportStatusText('服务端已完成处理，正在刷新列表...');
  };

  const handleImportSubmit = async () => {
    if (!importFile) {
      setImportStatusText('请先选择 Excel 文件后再开始导入');
      setMessage(ADMIN_TOAST_COPY.templateFileRequired('Excel 文件'));
      return;
    }

    try {
      setImporting(true);
      setImportProgress(0);
      setImportStatusText(`准备上传 ${importFile.name}，请勿关闭页面...`);
      setImportResult(null);

      const formData = new FormData();
      formData.append('file', importFile);

      const result = await clientUpload<AdminImportResult>('/admin/jobs/import', formData, {
        onProgress: handleImportProgress,
      });

      setImportResult(result);
      setImportProgress(100);
      setImportStatusText(`导入完成：共 ${result.total} 行，成功 ${result.success} 行，失败 ${result.failed} 行，耗时 ${(result.durationMs / 1000).toFixed(1)} 秒。`);
      setMessage(ADMIN_TOAST_COPY.importCompleted(result.total, result.success, result.failed));
      await loadData(1, filters);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '招聘公告导入失败';
      setImportProgress(0);
      setImportStatusText(`导入失败：${errorMessage}`);
      setMessage(errorMessage);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Admin jobs</p>
        <div className="mt-2 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-ink">招聘公告管理</h2>
            <p className="mt-2 text-sm text-muted">数据表已按“招聘公告汇总模板”重构，支持 Excel 模板下载、Excel 批量导入，以及后台手工维护全部 15 个模板字段。</p>
          </div>
          <Button onClick={openCreateModal}>新增公告</Button>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-ink">批量工具</h3>
            <p className="mt-1 text-sm text-muted">系统按表头名称智能匹配导入列；列顺序可打乱、列数可多可少、多余列自动忽略。仅“企业/单位全称”为必填，录入日期为空时系统自动补当前系统日期。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void handleTemplateDownload()} disabled={downloadingTemplate || importing}>
              {downloadingTemplate ? '模板下载中...' : '下载导入模板'}
            </Button>
            <Button variant="secondary" onClick={() => void handleExport()} disabled={exporting || importing}>
              {exporting ? '导出中...' : '导出筛选结果'}
            </Button>
            <Button variant="secondary" onClick={() => importInputRef.current?.click()} disabled={importing}>
              {importFile ? '重新选择文件' : '选择 Excel 文件'}
            </Button>
            <Button onClick={() => void handleImportSubmit()} disabled={importing || !importFile}>
              {importing ? '导入中...' : '开始导入'}
            </Button>
          </div>
        </div>
        <input
          ref={importInputRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="hidden"
          onChange={handleImportFileChange}
        />

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-semibold text-ink">当前导入文件</p>
            <p className="mt-2 break-all text-slate-700">{importFile?.name || '暂未选择文件'}</p>
            <p className="mt-2 text-xs leading-6 text-slate-500">
              {importFile ? `文件大小：${formatFileSize(importFile.size)}；单文件上限：${formatFileSize(MAX_JOB_IMPORT_FILE_SIZE)}。` : `支持 .xlsx / .xls，单文件最高 ${formatFileSize(MAX_JOB_IMPORT_FILE_SIZE)}。`}
            </p>
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>导入进度</span>
                <span>{importing || importProgress > 0 ? `${importProgress}%` : '未开始'}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-brand transition-all duration-300" style={{ width: `${importProgress}%` }} />
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">{importStatusText}</p>
            </div>
            <p className="mt-3 text-xs leading-6 text-slate-500">标准模板列头：{jobTemplateHeaders.join('、')}。上传文件可乱序，系统会自动识别匹配。</p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-semibold text-ink">最近一次导入结果</p>
            {importResult ? (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-center md:grid-cols-4">
                  <div className="rounded-2xl bg-white px-3 py-3">
                    <p className="text-xs text-slate-500">总行数</p>
                    <p className="mt-1 text-lg font-semibold text-ink">{importResult.total}</p>
                  </div>
                  <div className="rounded-2xl bg-white px-3 py-3">
                    <p className="text-xs text-slate-500">成功</p>
                    <p className="mt-1 text-lg font-semibold text-emerald-600">{importResult.success}</p>
                  </div>
                  <div className="rounded-2xl bg-white px-3 py-3">
                    <p className="text-xs text-slate-500">失败</p>
                    <p className="mt-1 text-lg font-semibold text-rose-600">{importResult.failed}</p>
                  </div>
                  <div className="rounded-2xl bg-white px-3 py-3">
                    <p className="text-xs text-slate-500">耗时</p>
                    <p className="mt-1 text-lg font-semibold text-ink">{(importResult.durationMs / 1000).toFixed(1)}s</p>
                  </div>
                </div>
                {importResult.errors.length ? (
                  <div>
                    <p className="font-semibold text-ink">错误明细</p>
                    <div className="mt-2 space-y-2">
                      {importResult.errors.map((item) => (
                        <div key={`${item.row}-${item.message}`} className="rounded-2xl bg-white px-3 py-2 text-xs leading-5 text-rose-600">
                          第 {item.row} 行：{item.message}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-emerald-600">本次导入未发现错误。</p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-slate-500">选择 Excel 并执行导入后，这里会展示服务端校验结果与耗时。</p>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <Card className="rounded-3xl p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input placeholder="搜索企业 / 岗位 / 地点 / 标题 / 行业" value={filters.keyword} onChange={(e) => setFilters((prev) => ({ ...prev, keyword: e.target.value }))} />
            <Select value={filters.enterpriseNature} onChange={(e) => setFilters((prev) => ({ ...prev, enterpriseNature: e.target.value }))}>
              <option value="">全部企业性质</option>
              {ENTERPRISE_NATURE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
            <Select value={filters.jobType} onChange={(e) => setFilters((prev) => ({ ...prev, jobType: e.target.value }))}>
              <option value="">全部招聘类型</option>
              {JOB_TYPE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => void loadData(1, filters)}>搜索</Button>
              <Button className="flex-1" variant="secondary" onClick={() => void handleReset()}>重置</Button>
            </div>
          </div>
        </Card>

        <AdminTable headers={['企业/单位全称', '岗位名称', '工作地点', '招聘类型', '截止日期', '录入日期']} hasData={data.list.length > 0} emptyText={loading ? '招聘公告加载中...' : '暂无招聘公告'}>
          {data.list.map((item) => (
            <tr
              key={item.id}
              className={`cursor-pointer border-b border-slate-100 last:border-b-0 ${selectedId === item.id ? 'bg-brand/5' : 'hover:bg-slate-50'}`}
              onClick={() => openEditModal(item)}
            >
              <td className="px-4 py-3 font-medium text-ink">{item.companyFullName}</td>
              <td className="px-4 py-3 text-slate-600">{item.jobName || '-'}</td>
              <td className="px-4 py-3 text-slate-600">{item.workLocation || '-'}</td>
              <td className="px-4 py-3 text-slate-600">{item.recruitmentType || '-'}</td>
              <td className="px-4 py-3 text-slate-600">{formatDate(item.deadlineAt)}</td>
              <td className="px-4 py-3 text-slate-600">{formatDate(item.entryDate)}</td>
            </tr>
          ))}
        </AdminTable>

        <AdminPagination
          page={data.pagination.page || 1}
          limit={data.pagination.limit || 10}
          total={data.pagination.total || 0}
          onPageChange={(nextPage) => void loadData(nextPage, filters)}
        />
      </section>

      <AdminModal
        open={editorOpen}
        title={selectedJob ? '编辑招聘公告' : '新增招聘公告'}
        description="仅“企业/单位全称”为必填；录入日期留空时，新增记录会自动使用当前系统日期。"
        onClose={closeEditorModal}
      >
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-muted">弹窗宽度已放大，完整承载公告维护表单和多行字段。</div>
            {selectedJob ? <Button variant="ghost" onClick={openCreateModal}>切换新增</Button> : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block space-y-2 lg:col-span-2">
              <span className="text-sm font-medium text-ink">企业/单位全称 *</span>
              <Input placeholder="请输入企业/单位全称" value={form.companyFullName} onChange={(e) => setForm((prev) => ({ ...prev, companyFullName: e.target.value }))} />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">企业性质</span>
              <Select value={form.enterpriseNature} onChange={(e) => setForm((prev) => ({ ...prev, enterpriseNature: e.target.value }))}>
                <option value="">请选择</option>
                {ENTERPRISE_NATURE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">学历要求</span>
              <Select value={form.degreeRequirement} onChange={(e) => setForm((prev) => ({ ...prev, degreeRequirement: e.target.value }))}>
                <option value="">请选择</option>
                {DEGREE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
            </label>

            <label className="block space-y-2 lg:col-span-2">
              <span className="text-sm font-medium text-ink">工作地点</span>
              <Textarea placeholder="支持批量填写多个城市/地区，如：南京、上海、北京、全国多地 / 海外站点" value={form.workLocation} onChange={(e) => setForm((prev) => ({ ...prev, workLocation: e.target.value }))} className="min-h-[88px]" />
            </label>

            <label className="block space-y-2 lg:col-span-2">
              <span className="text-sm font-medium text-ink">岗位名称</span>
              <Textarea placeholder="可填写单个或多个岗位名称" value={form.jobName} onChange={(e) => setForm((prev) => ({ ...prev, jobName: e.target.value }))} className="min-h-[88px]" />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">专业需求</span>
              <Textarea placeholder="支持填写多个专业要求，如：计算机类、软件工程、信息安全、人工智能等" value={form.majorRequirement} onChange={(e) => setForm((prev) => ({ ...prev, majorRequirement: e.target.value }))} className="min-h-[88px]" />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">招聘类型</span>
              <Select value={form.recruitmentType} onChange={(e) => setForm((prev) => ({ ...prev, recruitmentType: e.target.value }))}>
                <option value="">请选择</option>
                {JOB_TYPE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">截止日期</span>
              <Input placeholder="支持 yyyy-mm-dd / 2026/4/27 / 尽快投递" value={form.deadlineAt} onChange={(e) => setForm((prev) => ({ ...prev, deadlineAt: e.target.value }))} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">录入日期</span>
              <Input placeholder="支持 yyyy-mm-dd / 2026/4/27 / 46155" value={form.entryDate} onChange={(e) => setForm((prev) => ({ ...prev, entryDate: e.target.value }))} />
            </label>

            <label className="block space-y-2 lg:col-span-2">
              <span className="text-sm font-medium text-ink">公告链接</span>
              <Input placeholder="请输入招聘公告链接" value={form.announcementUrl} onChange={(e) => setForm((prev) => ({ ...prev, announcementUrl: e.target.value }))} />
            </label>

            <label className="block space-y-2 lg:col-span-2">
              <span className="text-sm font-medium text-ink">投递链接</span>
              <Input placeholder="请输入投递链接或邮箱" value={form.deliveryUrl} onChange={(e) => setForm((prev) => ({ ...prev, deliveryUrl: e.target.value }))} />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">毕业届别</span>
              <Input placeholder="如：2025届 / 2026届 / 2027届" value={form.graduationSession} onChange={(e) => setForm((prev) => ({ ...prev, graduationSession: e.target.value }))} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">内推码</span>
              <Input placeholder="如有内推码可填写" value={form.referralCode} onChange={(e) => setForm((prev) => ({ ...prev, referralCode: e.target.value }))} />
            </label>

            <label className="block space-y-2 lg:col-span-2">
              <span className="text-sm font-medium text-ink">招聘公告标题</span>
              <Input placeholder="请输入招聘公告标题" value={form.announcementTitle} onChange={(e) => setForm((prev) => ({ ...prev, announcementTitle: e.target.value }))} />
            </label>

            <label className="block space-y-2 lg:col-span-2">
              <span className="text-sm font-medium text-ink">行业</span>
              <Input placeholder="如：互联网 / 制造 / 金融" value={form.industry} onChange={(e) => setForm((prev) => ({ ...prev, industry: e.target.value }))} />
            </label>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            {selectedJob ? <Button variant="secondary" onClick={handleDelete}>删除公告</Button> : null}
            <Button variant="secondary" onClick={closeEditorModal}>取消</Button>
            <Button onClick={handleSubmit} disabled={saving}>{saving ? '保存中...' : '保存公告'}</Button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
