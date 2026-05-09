'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { AdminTable } from '@/components/admin/admin-table';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { buildQuery, downloadFilePayload } from '@/lib/admin';
import { clientFetch, clientUpload, type ClientUploadProgress } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { useGlobalToast } from '@/store/toast-store';
import {
  AdminFileDownloadPayload,
  AdminImportResult,
  AdminListResponse,
  AdminLocationHierarchyItem,
  AdminNormalizationAliasItem,
  AdminNormalizationSummary,
  AdminNormalizationTermItem,
} from '@/types';

const domainOptions = ['LOCATION', 'JOB_TITLE', 'MAJOR', 'DEGREE', 'COMPANY'] as const;
const statusOptions = [
  { value: '', label: '全部状态' },
  { value: 'active', label: '启用' },
  { value: 'inactive', label: '停用' },
] as const;
const locationLevelOptions = [
  { value: '', label: '不设置' },
  { value: 'province', label: '省份' },
  { value: 'city', label: '城市' },
] as const;
const matchModeOptions = [
  { value: 'exact', label: '精确匹配' },
  { value: 'contains', label: '包含匹配' },
] as const;
const tabOptions = [
  { value: 'terms', label: '标准词条' },
  { value: 'hierarchies', label: '省市关系' },
  { value: 'tools', label: '导入导出' },
] as const;
const MAX_IMPORT_FILE_SIZE = 20 * 1024 * 1024;

type TabKey = (typeof tabOptions)[number]['value'];

type TermFormState = {
  domain: (typeof domainOptions)[number];
  canonicalName: string;
  canonicalCode: string;
  level: string;
  status: 'active' | 'inactive';
  sortOrder: string;
  metadataJson: string;
};

type AliasFormState = {
  aliasName: string;
  matchMode: 'exact' | 'contains';
  status: 'active' | 'inactive';
  source: string;
  sortOrder: string;
};

type HierarchyFormState = {
  provinceTermId: string;
  cityTermId: string;
  status: 'active' | 'inactive';
};

const emptySummary: AdminNormalizationSummary = {
  termCount: 0,
  aliasCount: 0,
  locationHierarchyCount: 0,
  updatedAt: null,
};

const emptyTermForm: TermFormState = {
  domain: 'JOB_TITLE',
  canonicalName: '',
  canonicalCode: '',
  level: '',
  status: 'active',
  sortOrder: '0',
  metadataJson: '',
};

const emptyAliasForm: AliasFormState = {
  aliasName: '',
  matchMode: 'exact',
  status: 'active',
  source: '',
  sortOrder: '0',
};

const emptyHierarchyForm: HierarchyFormState = {
  provinceTermId: '',
  cityTermId: '',
  status: 'active',
};

const initialTermFilters = {
  domain: '',
  status: '',
  keyword: '',
};

const initialAliasFilters = {
  status: '',
  keyword: '',
};

const initialHierarchyFilters = {
  provinceTermId: '',
  status: '',
  keyword: '',
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function ModalShell({
  open,
  title,
  description,
  onClose,
  children,
  widthClass = 'max-w-6xl',
}: {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
  widthClass?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-8">
      <div className={`max-h-[90vh] w-full overflow-hidden rounded-[28px] bg-white shadow-2xl ${widthClass}`}>
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h3 className="text-2xl font-bold text-ink">{title}</h3>
            <p className="mt-2 text-sm text-muted">{description}</p>
          </div>
          <Button variant="ghost" onClick={onClose}>关闭</Button>
        </div>
        <div className="max-h-[calc(90vh-96px)] overflow-y-auto px-6 py-6">{children}</div>
      </div>
    </div>
  );
}

function buildTermForm(item?: AdminNormalizationTermItem | null): TermFormState {
  return item
    ? {
        domain: item.domain as TermFormState['domain'],
        canonicalName: item.canonicalName,
        canonicalCode: item.canonicalCode || '',
        level: item.level || '',
        status: item.status === 'inactive' ? 'inactive' : 'active',
        sortOrder: String(item.sortOrder ?? 0),
        metadataJson: item.metadata ? JSON.stringify(item.metadata, null, 2) : '',
      }
    : emptyTermForm;
}

function buildAliasForm(item?: AdminNormalizationAliasItem | null): AliasFormState {
  return item
    ? {
        aliasName: item.aliasName,
        matchMode: item.matchMode === 'contains' ? 'contains' : 'exact',
        status: item.status === 'inactive' ? 'inactive' : 'active',
        source: item.source || '',
        sortOrder: String(item.sortOrder ?? 0),
      }
    : emptyAliasForm;
}

function buildHierarchyForm(item?: AdminLocationHierarchyItem | null): HierarchyFormState {
  return item
    ? {
        provinceTermId: item.provinceTermId,
        cityTermId: item.cityTermId,
        status: item.status === 'inactive' ? 'inactive' : 'active',
      }
    : emptyHierarchyForm;
}

function parseMetadataJson(metadataJson: string) {
  const trimmed = metadataJson.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = JSON.parse(trimmed);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('metadata 仅支持 JSON 对象');
  }
  return parsed as Record<string, unknown>;
}

function normalizeAliasPreview(value?: string | null) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[·•（）()【】\[\]，,、；;｜|/]/g, '');
}

export default function AdminNormalizationDictionaryPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('terms');
  const [summary, setSummary] = useState<AdminNormalizationSummary>(emptySummary);
  const [message, setMessage] = useState('');

  const [termFilters, setTermFilters] = useState(initialTermFilters);
  const [termData, setTermData] = useState<AdminListResponse<AdminNormalizationTermItem>>({
    list: [],
    pagination: { page: 1, limit: 10, total: 0, hasMore: false },
  });
  const [termLoading, setTermLoading] = useState(true);
  const [termSaving, setTermSaving] = useState(false);
  const [termDeleting, setTermDeleting] = useState(false);
  const [termModalOpen, setTermModalOpen] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<AdminNormalizationTermItem | null>(null);
  const [termForm, setTermForm] = useState<TermFormState>(emptyTermForm);

  const [aliasFilters, setAliasFilters] = useState(initialAliasFilters);
  const [aliasData, setAliasData] = useState<AdminListResponse<AdminNormalizationAliasItem>>({
    list: [],
    pagination: { page: 1, limit: 100, total: 0, hasMore: false },
  });
  const [aliasLoading, setAliasLoading] = useState(false);
  const [aliasSaving, setAliasSaving] = useState(false);
  const [aliasDeleting, setAliasDeleting] = useState(false);
  const [selectedAlias, setSelectedAlias] = useState<AdminNormalizationAliasItem | null>(null);
  const [aliasForm, setAliasForm] = useState<AliasFormState>(emptyAliasForm);

  const [locationOptions, setLocationOptions] = useState<AdminNormalizationTermItem[]>([]);

  const [hierarchyFilters, setHierarchyFilters] = useState(initialHierarchyFilters);
  const [hierarchyData, setHierarchyData] = useState<AdminListResponse<AdminLocationHierarchyItem>>({
    list: [],
    pagination: { page: 1, limit: 10, total: 0, hasMore: false },
  });
  const [hierarchyLoading, setHierarchyLoading] = useState(true);
  const [hierarchySaving, setHierarchySaving] = useState(false);
  const [hierarchyDeleting, setHierarchyDeleting] = useState(false);
  const [hierarchyModalOpen, setHierarchyModalOpen] = useState(false);
  const [selectedHierarchy, setSelectedHierarchy] = useState<AdminLocationHierarchyItem | null>(null);
  const [hierarchyForm, setHierarchyForm] = useState<HierarchyFormState>(emptyHierarchyForm);

  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatusText, setImportStatusText] = useState('请选择 Excel 文件后开始导入');
  const [importResult, setImportResult] = useState<AdminImportResult | null>(null);

  const importInputRef = useRef<HTMLInputElement | null>(null);

  useGlobalToast(message, setMessage);

  const aliasNormalizedPreview = useMemo(() => normalizeAliasPreview(aliasForm.aliasName), [aliasForm.aliasName]);
  const provinceOptions = useMemo(
    () => locationOptions.filter((item) => item.level === 'province'),
    [locationOptions],
  );
  const cityOptions = useMemo(
    () => locationOptions.filter((item) => item.level === 'city'),
    [locationOptions],
  );

  const loadSummary = async () => {
    const result = await clientFetch<AdminNormalizationSummary>('/admin/normalization-summary');
    setSummary(result);
  };

  const loadLocationOptions = async () => {
    const queryString = buildQuery({ domain: 'LOCATION', page: 1, limit: 500 });
    const result = await clientFetch<AdminListResponse<AdminNormalizationTermItem>>(`/admin/normalization-terms?${queryString}`);
    setLocationOptions(result.list);
  };

  const loadTerms = async (page = termData.pagination.page || 1, nextFilters = termFilters) => {
    try {
      setTermLoading(true);
      const queryString = buildQuery({ ...nextFilters, page, limit: 10 });
      const result = await clientFetch<AdminListResponse<AdminNormalizationTermItem>>(`/admin/normalization-terms?${queryString}`);
      setTermData(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '标准词列表加载失败');
    } finally {
      setTermLoading(false);
    }
  };

  const loadAliases = async (termId: string, nextFilters = aliasFilters) => {
    try {
      setAliasLoading(true);
      const queryString = buildQuery({ ...nextFilters, page: 1, limit: 100 });
      const result = await clientFetch<AdminListResponse<AdminNormalizationAliasItem>>(`/admin/normalization-terms/${termId}/aliases?${queryString}`);
      setAliasData(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '别名列表加载失败');
    } finally {
      setAliasLoading(false);
    }
  };

  const loadHierarchies = async (page = hierarchyData.pagination.page || 1, nextFilters = hierarchyFilters) => {
    try {
      setHierarchyLoading(true);
      const queryString = buildQuery({ ...nextFilters, page, limit: 10 });
      const result = await clientFetch<AdminListResponse<AdminLocationHierarchyItem>>(`/admin/location-hierarchies?${queryString}`);
      setHierarchyData(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '省市关系列表加载失败');
    } finally {
      setHierarchyLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void Promise.all([loadSummary(), loadTerms(1, termFilters), loadHierarchies(1, hierarchyFilters), loadLocationOptions()]).catch((error) => {
      setMessage(error instanceof Error ? error.message : '后台词典页面初始化失败');
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (termModalOpen && selectedTerm?.id) {
      void loadAliases(selectedTerm.id, aliasFilters);
    }
  }, [termModalOpen, selectedTerm?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreateTermModal = () => {
    setSelectedTerm(null);
    setTermForm(emptyTermForm);
    setSelectedAlias(null);
    setAliasForm(emptyAliasForm);
    setAliasData({ list: [], pagination: { page: 1, limit: 100, total: 0, hasMore: false } });
    setAliasFilters(initialAliasFilters);
    setTermModalOpen(true);
  };

  const openEditTermModal = async (item: AdminNormalizationTermItem) => {
    setSelectedTerm(item);
    setTermForm(buildTermForm(item));
    setSelectedAlias(null);
    setAliasForm(emptyAliasForm);
    setAliasFilters(initialAliasFilters);
    setTermModalOpen(true);
    await loadAliases(item.id, initialAliasFilters);
  };

  const closeTermModal = () => {
    setTermModalOpen(false);
    setSelectedTerm(null);
    setTermForm(emptyTermForm);
    setSelectedAlias(null);
    setAliasForm(emptyAliasForm);
  };

  const openCreateHierarchyModal = () => {
    setSelectedHierarchy(null);
    setHierarchyForm(emptyHierarchyForm);
    setHierarchyModalOpen(true);
  };

  const openEditHierarchyModal = (item: AdminLocationHierarchyItem) => {
    setSelectedHierarchy(item);
    setHierarchyForm(buildHierarchyForm(item));
    setHierarchyModalOpen(true);
  };

  const closeHierarchyModal = () => {
    setHierarchyModalOpen(false);
    setSelectedHierarchy(null);
    setHierarchyForm(emptyHierarchyForm);
  };

  const handleTermSubmit = async () => {
    try {
      setTermSaving(true);
      const payload = {
        domain: termForm.domain,
        canonicalName: termForm.canonicalName,
        canonicalCode: termForm.canonicalCode.trim() ? termForm.canonicalCode : null,
        level: termForm.domain === 'LOCATION' ? (termForm.level || undefined) : undefined,
        status: termForm.status,
        sortOrder: Number(termForm.sortOrder || 0),
        metadata: parseMetadataJson(termForm.metadataJson),
      };
      const result = selectedTerm
        ? await clientFetch<AdminNormalizationTermItem>(`/admin/normalization-terms/${selectedTerm.id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : await clientFetch<AdminNormalizationTermItem>('/admin/normalization-terms', {
            method: 'POST',
            body: JSON.stringify(payload),
          });

      setSelectedTerm(result);
      setTermForm(buildTermForm(result));
      setMessage(selectedTerm ? '标准词已更新' : '标准词已创建');
      await Promise.all([
        loadSummary(),
        loadTerms(selectedTerm ? termData.pagination.page || 1 : 1, termFilters),
        loadLocationOptions(),
        loadHierarchies(hierarchyData.pagination.page || 1, hierarchyFilters),
      ]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '标准词保存失败');
    } finally {
      setTermSaving(false);
    }
  };

  const deleteTermItem = async (item: AdminNormalizationTermItem) => {
    if (!window.confirm(`确认删除标准词“${item.canonicalName}”吗？`)) return;
    try {
      setTermDeleting(true);
      await clientFetch(`/admin/normalization-terms/${item.id}`, { method: 'DELETE' });
      if (selectedTerm?.id === item.id) {
        closeTermModal();
      }
      setMessage('标准词已删除');
      await Promise.all([
        loadSummary(),
        loadTerms(1, termFilters),
        loadLocationOptions(),
        loadHierarchies(1, hierarchyFilters),
      ]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '标准词删除失败');
    } finally {
      setTermDeleting(false);
    }
  };

  const handleDeleteTerm = async () => {
    if (!selectedTerm) return;
    await deleteTermItem(selectedTerm);
  };

  const handleAliasSubmit = async () => {
    if (!selectedTerm) {
      setMessage('请先保存标准词后再维护别名');
      return;
    }
    try {
      setAliasSaving(true);
      const payload = {
        aliasName: aliasForm.aliasName,
        matchMode: aliasForm.matchMode,
        status: aliasForm.status,
        source: aliasForm.source.trim() ? aliasForm.source : null,
        sortOrder: Number(aliasForm.sortOrder || 0),
      };
      await (selectedAlias
        ? clientFetch<AdminNormalizationAliasItem>(`/admin/normalization-aliases/${selectedAlias.id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : clientFetch<AdminNormalizationAliasItem>(`/admin/normalization-terms/${selectedTerm.id}/aliases`, {
            method: 'POST',
            body: JSON.stringify(payload),
          }));
      setSelectedAlias(null);
      setAliasForm(emptyAliasForm);
      setMessage(selectedAlias ? '别名已更新' : '别名已创建');
      await Promise.all([
        loadAliases(selectedTerm.id, aliasFilters),
        loadSummary(),
        loadTerms(termData.pagination.page || 1, termFilters),
      ]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '别名保存失败');
    } finally {
      setAliasSaving(false);
    }
  };

  const handleDeleteAlias = async (item: AdminNormalizationAliasItem) => {
    if (!selectedTerm) return;
    if (!window.confirm(`确认删除别名“${item.aliasName}”吗？`)) return;
    try {
      setAliasDeleting(true);
      await clientFetch(`/admin/normalization-aliases/${item.id}`, { method: 'DELETE' });
      if (selectedAlias?.id === item.id) {
        setSelectedAlias(null);
        setAliasForm(emptyAliasForm);
      }
      setMessage('别名已删除');
      await Promise.all([
        loadAliases(selectedTerm.id, aliasFilters),
        loadSummary(),
        loadTerms(termData.pagination.page || 1, termFilters),
      ]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '别名删除失败');
    } finally {
      setAliasDeleting(false);
    }
  };

  const handleHierarchySubmit = async () => {
    try {
      setHierarchySaving(true);
      const payload = {
        provinceTermId: hierarchyForm.provinceTermId,
        cityTermId: hierarchyForm.cityTermId,
        status: hierarchyForm.status,
      };
      await (selectedHierarchy
        ? clientFetch<AdminLocationHierarchyItem>(`/admin/location-hierarchies/${selectedHierarchy.id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : clientFetch<AdminLocationHierarchyItem>('/admin/location-hierarchies', {
            method: 'POST',
            body: JSON.stringify(payload),
          }));
      setMessage(selectedHierarchy ? '省市关系已更新' : '省市关系已创建');
      closeHierarchyModal();
      await Promise.all([
        loadSummary(),
        loadHierarchies(selectedHierarchy ? hierarchyData.pagination.page || 1 : 1, hierarchyFilters),
      ]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '省市关系保存失败');
    } finally {
      setHierarchySaving(false);
    }
  };

  const deleteHierarchyItem = async (item: AdminLocationHierarchyItem) => {
    if (!window.confirm(`确认删除关系“${item.provinceCanonicalName} → ${item.cityCanonicalName}”吗？`)) return;
    try {
      setHierarchyDeleting(true);
      await clientFetch(`/admin/location-hierarchies/${item.id}`, { method: 'DELETE' });
      if (selectedHierarchy?.id === item.id) {
        closeHierarchyModal();
      }
      setMessage('省市关系已删除');
      await Promise.all([loadSummary(), loadHierarchies(1, hierarchyFilters)]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '省市关系删除失败');
    } finally {
      setHierarchyDeleting(false);
    }
  };

  const handleDeleteHierarchy = async () => {
    if (!selectedHierarchy) return;
    await deleteHierarchyItem(selectedHierarchy);
  };

  const clearImportSelection = () => {
    setImportFile(null);
    setImportProgress(0);
    setImportResult(null);
    setImportStatusText('请选择 Excel 文件后开始导入');
    if (importInputRef.current) {
      importInputRef.current.value = '';
    }
  };

  const handleTemplateDownload = async () => {
    try {
      setDownloadingTemplate(true);
      const payload = await clientFetch<AdminFileDownloadPayload>('/admin/normalization/template');
      downloadFilePayload(payload);
      setMessage('标准化词典模板已下载');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '模板下载失败');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const payload = await clientFetch<AdminFileDownloadPayload>('/admin/normalization/export');
      downloadFilePayload(payload);
      setMessage('标准化词典已导出');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导出失败');
    } finally {
      setExporting(false);
    }
  };

  const handleImportFileChange = (event: ChangeEvent<HTMLInputElement>) => {
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
    if (file.size > MAX_IMPORT_FILE_SIZE) {
      clearImportSelection();
      setMessage(`Excel 文件不能超过 ${formatFileSize(MAX_IMPORT_FILE_SIZE)}`);
      return;
    }
    setImportFile(file);
    setImportResult(null);
    setImportProgress(0);
    setImportStatusText(`已选择 ${file.name}（${formatFileSize(file.size)}），点击“开始导入”后将自动处理三张 Sheet。`);
    setMessage(`已选择词典导入文件：${file.name}`);
  };

  const handleImportProgress = (progress: ClientUploadProgress) => {
    if (progress.phase === 'uploading') {
      setImportProgress(progress.percent);
      setImportStatusText(progress.total > 0
        ? `正在上传文件：${formatFileSize(progress.loaded)} / ${formatFileSize(progress.total)}`
        : '正在上传文件...');
      return;
    }
    if (progress.phase === 'processing') {
      setImportProgress((current) => (current < progress.percent ? progress.percent : current));
      setImportStatusText('文件上传完成，服务端正在解析 terms / aliases / location_hierarchy...');
      return;
    }
    setImportProgress(100);
    setImportStatusText('服务端处理完成，正在刷新词典数据...');
  };

  const handleImportSubmit = async () => {
    if (!importFile) {
      setMessage('请先选择待导入的 Excel 文件');
      return;
    }
    try {
      setImporting(true);
      setImportResult(null);
      setImportProgress(0);
      setImportStatusText(`准备上传 ${importFile.name}，请勿关闭页面...`);
      const formData = new FormData();
      formData.append('file', importFile);
      const result = await clientUpload<AdminImportResult>('/admin/normalization/import', formData, {
        onProgress: handleImportProgress,
      });
      setImportResult(result);
      setImportProgress(100);
      setImportStatusText(`导入完成：共 ${result.total} 行，成功 ${result.success} 行，失败 ${result.failed} 行。`);
      setMessage(`词典导入完成：成功 ${result.success} 行，失败 ${result.failed} 行`);
      await Promise.all([
        loadSummary(),
        loadTerms(1, termFilters),
        loadHierarchies(1, hierarchyFilters),
        loadLocationOptions(),
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '词典导入失败';
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
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Normalization dictionary center</p>
        <div className="mt-2 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-ink">标准化词典中心</h2>
            <p className="mt-2 text-sm text-muted">统一维护标准词、别名和省市父子关系；保存或导入成功后会自动清空标准化缓存和推荐缓存，立即影响专属推荐链路。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setActiveTab('tools')}>前往导入导出</Button>
            <Button onClick={openCreateTermModal}>新增标准词</Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-3xl p-5">
          <p className="text-sm text-muted">标准词总数</p>
          <p className="mt-2 text-3xl font-bold text-ink">{summary.termCount}</p>
        </Card>
        <Card className="rounded-3xl p-5">
          <p className="text-sm text-muted">别名总数</p>
          <p className="mt-2 text-3xl font-bold text-ink">{summary.aliasCount}</p>
        </Card>
        <Card className="rounded-3xl p-5">
          <p className="text-sm text-muted">省市关系总数</p>
          <p className="mt-2 text-3xl font-bold text-ink">{summary.locationHierarchyCount}</p>
        </Card>
        <Card className="rounded-3xl p-5">
          <p className="text-sm text-muted">最近更新时间</p>
          <p className="mt-2 text-sm font-semibold text-ink">{summary.updatedAt ? formatDate(summary.updatedAt) : '暂无更新记录'}</p>
        </Card>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-card">
        <div className="flex flex-wrap gap-2">
          {tabOptions.map((tab) => (
            <button
              key={tab.value}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${activeTab === tab.value ? 'bg-brand text-white shadow-card' : 'bg-slate-100 text-slate-600 hover:bg-brand/10 hover:text-brand'}`}
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === 'terms' ? (
        <section className="space-y-4">
          <Card className="rounded-3xl p-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <Select value={termFilters.domain} onChange={(event) => setTermFilters((prev) => ({ ...prev, domain: event.target.value }))}>
                <option value="">全部词典域</option>
                {domainOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
              <Select value={termFilters.status} onChange={(event) => setTermFilters((prev) => ({ ...prev, status: event.target.value }))}>
                {statusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </Select>
              <Input
                className="xl:col-span-2"
                value={termFilters.keyword}
                placeholder="搜索标准词 / 编码 / 别名"
                onChange={(event) => setTermFilters((prev) => ({ ...prev, keyword: event.target.value }))}
              />
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => void loadTerms(1, termFilters)}>查询</Button>
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    setTermFilters(initialTermFilters);
                    void loadTerms(1, initialTermFilters);
                  }}
                >
                  重置
                </Button>
              </div>
            </div>
          </Card>

          <AdminTable
            headers={['标准词', '词典域', '层级', '状态', '别名数', '排序', '更新时间', '操作']}
            hasData={termData.list.length > 0}
            emptyText={termLoading ? '正在加载标准词...' : '暂无标准词数据'}
          >
            {termData.list.map((item) => (
              <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
                <td className="px-4 py-3">
                  <p className="font-semibold text-ink">{item.canonicalName}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.canonicalCode || '未设置编码'}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{item.domain}</td>
                <td className="px-4 py-3 text-slate-600">{item.level || '-'}</td>
                <td className="px-4 py-3 text-slate-600">{item.status === 'active' ? '启用' : '停用'}</td>
                <td className="px-4 py-3 text-slate-600">{item.aliasCount}</td>
                <td className="px-4 py-3 text-slate-600">{item.sortOrder}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(item.updatedAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => void openEditTermModal(item)}>编辑</Button>
                    <Button variant="ghost" onClick={() => void openEditTermModal(item)}>管理别名</Button>
                    <Button variant="ghost" disabled={termDeleting} onClick={() => void deleteTermItem(item)}>删除</Button>
                  </div>
                </td>
              </tr>
            ))}
          </AdminTable>

          <AdminPagination
            page={termData.pagination.page}
            limit={termData.pagination.limit}
            total={termData.pagination.total}
            onPageChange={(page) => void loadTerms(page, termFilters)}
          />
        </section>
      ) : null}

      {activeTab === 'hierarchies' ? (
        <section className="space-y-4">
          <Card className="rounded-3xl p-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Select value={hierarchyFilters.provinceTermId} onChange={(event) => setHierarchyFilters((prev) => ({ ...prev, provinceTermId: event.target.value }))}>
                  <option value="">全部省份</option>
                  {provinceOptions.map((item) => <option key={item.id} value={item.id}>{item.canonicalName}</option>)}
                </Select>
                <Select value={hierarchyFilters.status} onChange={(event) => setHierarchyFilters((prev) => ({ ...prev, status: event.target.value }))}>
                  {statusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </Select>
                <Input
                  className="xl:col-span-2"
                  value={hierarchyFilters.keyword}
                  placeholder="搜索省份 / 城市"
                  onChange={(event) => setHierarchyFilters((prev) => ({ ...prev, keyword: event.target.value }))}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => void loadHierarchies(1, hierarchyFilters)}>查询</Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setHierarchyFilters(initialHierarchyFilters);
                    void loadHierarchies(1, initialHierarchyFilters);
                  }}
                >
                  重置
                </Button>
                <Button onClick={openCreateHierarchyModal}>新增关系</Button>
              </div>
            </div>
          </Card>

          <AdminTable
            headers={['省份', '城市', '状态', '更新时间', '操作']}
            hasData={hierarchyData.list.length > 0}
            emptyText={hierarchyLoading ? '正在加载省市关系...' : '暂无省市关系数据'}
          >
            {hierarchyData.list.map((item) => (
              <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
                <td className="px-4 py-3 font-semibold text-ink">{item.provinceCanonicalName}</td>
                <td className="px-4 py-3 text-slate-600">{item.cityCanonicalName}</td>
                <td className="px-4 py-3 text-slate-600">{item.status === 'active' ? '启用' : '停用'}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(item.updatedAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => openEditHierarchyModal(item)}>编辑</Button>
                    <Button variant="ghost" disabled={hierarchyDeleting} onClick={() => void deleteHierarchyItem(item)}>删除</Button>
                  </div>
                </td>
              </tr>
            ))}
          </AdminTable>

          <AdminPagination
            page={hierarchyData.pagination.page}
            limit={hierarchyData.pagination.limit}
            total={hierarchyData.pagination.total}
            onPageChange={(page) => void loadHierarchies(page, hierarchyFilters)}
          />
        </section>
      ) : null}

      {activeTab === 'tools' ? (
        <section className="space-y-4">
          <Card className="rounded-3xl p-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-ink">批量工具</h3>
                <p className="mt-1 text-sm text-muted">导入文件必须包含 `terms / aliases / location_hierarchy` 三张 Sheet，系统会按顺序先导入标准词、再导入别名、最后建立省市关系。高歧义 alias 建议使用 `exact`，稳定长词 alias 再使用 `contains` 打开搜索与推荐文本召回。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => void handleTemplateDownload()} disabled={downloadingTemplate || importing}>
                  {downloadingTemplate ? '模板下载中...' : '下载导入模板'}
                </Button>
                <Button variant="secondary" onClick={() => void handleExport()} disabled={exporting || importing}>
                  {exporting ? '导出中...' : '导出全量词典'}
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
                  {importFile ? `文件大小：${formatFileSize(importFile.size)}；单文件上限：${formatFileSize(MAX_IMPORT_FILE_SIZE)}。` : `支持 .xlsx / .xls，单文件最高 ${formatFileSize(MAX_IMPORT_FILE_SIZE)}。`}
                </p>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>导入进度</span>
                    <span>{importProgress}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${importProgress}%` }} />
                  </div>
                  <p className="mt-3 text-xs leading-6 text-slate-500">{importStatusText}</p>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-semibold text-ink">最近一次导入结果</p>
                {importResult ? (
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-3 gap-3 text-center">
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
                    </div>
                    <p className="text-xs text-slate-500">耗时 {(importResult.durationMs / 1000).toFixed(1)} 秒，错误列表最多展示前 20 条。</p>
                    {importResult.errors.length ? (
                      <div className="max-h-48 overflow-y-auto rounded-2xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">
                        {importResult.errors.map((item) => (
                          <p key={`${item.row}-${item.message}`} className="mb-2 last:mb-0">第 {item.row} 行：{item.message}</p>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-3 text-xs text-emerald-700">最近一次导入没有错误。</p>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-xs leading-6 text-slate-500">尚未执行导入。建议先下载模板，保持三张 Sheet 名和列头完全一致后再上传。</p>
                )}
              </div>
            </div>
          </Card>

          <Card className="rounded-3xl p-5">
            <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-ink">导入导出样例</h3>
                  <p className="mt-1 text-sm text-muted">导入模板可直接下载；下面给出运营最常用的三类示例行，便于复核 Sheet 填写口径。</p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-ink">`terms` 示例</p>
                    <div className="mt-3 rounded-2xl bg-[#0F172A] px-3 py-3 font-mono text-[11px] leading-6 text-slate-100">
                      {'LOCATION, 济南, CN-SD-JN, city, active, 20, {"source":"import"}'}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-ink">`aliases` 示例</p>
                    <div className="mt-3 space-y-2 rounded-2xl bg-[#0F172A] px-3 py-3 font-mono text-[11px] leading-6 text-slate-100">
                      <p>JOB_TITLE, 人事 / 行政, 行政, exact, active, import, 10</p>
                      <p>JOB_TITLE, 前端, Web前端开发, contains, active, import, 20</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-ink">`location_hierarchy` 示例</p>
                    <div className="mt-3 rounded-2xl bg-[#0F172A] px-3 py-3 font-mono text-[11px] leading-6 text-slate-100">
                      山东, 济南, active
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-800">
                  <p className="font-semibold">运营建议</p>
                  <p className="mt-1">`exact` 适合“行政 / 会计 / 金融 / 移动”这类高歧义短词，只做归一；`contains` 适合“Web前端开发 / 中国联合网络通信 / 大学本科 / 计算机科学与技术”这类稳定长词，会进入搜索与推荐文本召回。</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-ink">运营验收样例</h3>
                  <p className="mt-1 text-sm text-muted">建议按下面 4 组场景做验收，覆盖写库、搜索、推荐和地点关系四条链路。</p>
                </div>
                <div className="space-y-3 text-sm text-slate-600">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="font-semibold text-ink">样例 1：高歧义 alias 只归一不泛召回</p>
                    <p className="mt-1 text-xs leading-6">输入 `行政` → 写库归一为 `人事 / 行政`；但搜索 / 推荐不应仅因公告里出现“综合行政”就大面积命中。</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="font-semibold text-ink">样例 2：企业 alias 命中提升</p>
                    <p className="mt-1 text-xs leading-6">输入 `中烟` → 应归一到 `中国烟草`，并能命中 `山东中烟 / 江苏中烟 / 上海烟草集团` 等公告。</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="font-semibold text-ink">样例 3：岗位与学历 alias 命中提升</p>
                    <p className="mt-1 text-xs leading-6">输入 `Web前端开发 + 大学本科` → 应归一到 `前端 + 本科`，并命中 `前端开发工程师 / 大学本科及以上` 这类岗位。</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="font-semibold text-ink">样例 4：地点父级关系联动</p>
                    <p className="mt-1 text-xs leading-6">输入 `深` 或 `深圳市` → 应归一到 `深圳`；地点筛选与推荐地点命中都要按 `深圳 → 广东` 口径联动生效。</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </section>
      ) : null}

      <ModalShell
        open={termModalOpen}
        title={selectedTerm ? `编辑标准词：${selectedTerm.canonicalName}` : '新增标准词'}
        description="标准词保存成功后，可在同一窗口继续维护别名。对于 LOCATION 域，必须选择省份或城市层级。"
        onClose={closeTermModal}
      >
        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="grid gap-3">
              <label>
                <span className="mb-2 block text-sm font-medium text-ink">词典域</span>
                <Select value={termForm.domain} onChange={(event) => setTermForm((prev) => ({ ...prev, domain: event.target.value as TermFormState['domain'], level: event.target.value === 'LOCATION' ? prev.level : '' }))}>
                  {domainOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </Select>
              </label>
              <label>
                <span className="mb-2 block text-sm font-medium text-ink">标准词</span>
                <Input value={termForm.canonicalName} onChange={(event) => setTermForm((prev) => ({ ...prev, canonicalName: event.target.value }))} />
              </label>
              <label>
                <span className="mb-2 block text-sm font-medium text-ink">编码</span>
                <Input value={termForm.canonicalCode} onChange={(event) => setTermForm((prev) => ({ ...prev, canonicalCode: event.target.value }))} placeholder="可选，用于后续对账或导入" />
              </label>
              <label>
                <span className="mb-2 block text-sm font-medium text-ink">层级</span>
                <Select value={termForm.level} disabled={termForm.domain !== 'LOCATION'} onChange={(event) => setTermForm((prev) => ({ ...prev, level: event.target.value }))}>
                  {locationLevelOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </Select>
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label>
                  <span className="mb-2 block text-sm font-medium text-ink">状态</span>
                  <Select value={termForm.status} onChange={(event) => setTermForm((prev) => ({ ...prev, status: event.target.value as TermFormState['status'] }))}>
                    {statusOptions.filter((item) => item.value).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </Select>
                </label>
                <label>
                  <span className="mb-2 block text-sm font-medium text-ink">排序</span>
                  <Input type="number" value={termForm.sortOrder} onChange={(event) => setTermForm((prev) => ({ ...prev, sortOrder: event.target.value }))} />
                </label>
              </div>
              <label>
                <span className="mb-2 block text-sm font-medium text-ink">metadata（JSON 对象）</span>
                <Textarea
                  rows={8}
                  value={termForm.metadataJson}
                  onChange={(event) => setTermForm((prev) => ({ ...prev, metadataJson: event.target.value }))}
                  placeholder="例如：{&#10;  &quot;source&quot;: &quot;manual&quot;&#10;}"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void handleTermSubmit()} disabled={termSaving}>{termSaving ? '保存中...' : '保存标准词'}</Button>
              <Button variant="secondary" onClick={closeTermModal}>取消</Button>
              {selectedTerm ? (
                <Button variant="ghost" onClick={() => void handleDeleteTerm()} disabled={termDeleting}>{termDeleting ? '删除中...' : '删除标准词'}</Button>
              ) : null}
            </div>
          </div>

          <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h4 className="text-xl font-semibold text-ink">别名维护</h4>
                <p className="mt-1 text-sm text-muted">别名保存后会立即进入标准化查词与推荐匹配链路。</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={!selectedTerm}
                  onClick={() => {
                    setSelectedAlias(null);
                    setAliasForm(emptyAliasForm);
                  }}
                >
                  新增别名
                </Button>
              </div>
            </div>

            {!selectedTerm ? (
              <Card className="rounded-3xl p-6 text-sm text-muted">请先保存标准词，然后再在这里维护别名。</Card>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_160px_160px_auto]">
                  <Input
                    value={aliasFilters.keyword}
                    placeholder="搜索别名"
                    onChange={(event) => setAliasFilters((prev) => ({ ...prev, keyword: event.target.value }))}
                  />
                  <Select value={aliasFilters.status} onChange={(event) => setAliasFilters((prev) => ({ ...prev, status: event.target.value }))}>
                    {statusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </Select>
                  <Button variant="secondary" onClick={() => void loadAliases(selectedTerm.id, aliasFilters)}>查询别名</Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setAliasFilters(initialAliasFilters);
                      void loadAliases(selectedTerm.id, initialAliasFilters);
                    }}
                  >
                    重置
                  </Button>
                </div>

                <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <h5 className="text-base font-semibold text-ink">{selectedAlias ? `编辑别名：${selectedAlias.aliasName}` : '新增别名'}</h5>
                    <div className="mt-4 grid gap-3">
                      <label>
                        <span className="mb-2 block text-sm font-medium text-ink">别名</span>
                        <Input value={aliasForm.aliasName} onChange={(event) => setAliasForm((prev) => ({ ...prev, aliasName: event.target.value }))} />
                      </label>
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">aliasNormalized 预览</p>
                        <p className="mt-2 break-all text-sm font-semibold text-ink">{aliasNormalizedPreview || '请输入别名后查看标准化结果'}</p>
                        <p className="mt-2 text-xs leading-5 text-slate-500">只读预览用于帮助排查空格、括号和标点折叠后的命中效果；实际入库结果仍以后端统一标准化逻辑为准。</p>
                      </div>
                      <label>
                        <span className="mb-2 block text-sm font-medium text-ink">匹配方式</span>
                        <Select value={aliasForm.matchMode} onChange={(event) => setAliasForm((prev) => ({ ...prev, matchMode: event.target.value as AliasFormState['matchMode'] }))}>
                          {matchModeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </Select>
                        <p className="mt-2 text-xs leading-5 text-slate-500">`exact`：仅用于查词归一；`contains`：除归一外，还会进入搜索与推荐的文本召回，请只给稳定长词使用。</p>
                      </label>
                      <label>
                        <span className="mb-2 block text-sm font-medium text-ink">状态</span>
                        <Select value={aliasForm.status} onChange={(event) => setAliasForm((prev) => ({ ...prev, status: event.target.value as AliasFormState['status'] }))}>
                          {statusOptions.filter((item) => item.value).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </Select>
                      </label>
                      <label>
                        <span className="mb-2 block text-sm font-medium text-ink">来源</span>
                        <Input value={aliasForm.source} onChange={(event) => setAliasForm((prev) => ({ ...prev, source: event.target.value }))} placeholder="如：manual / seed / import" />
                      </label>
                      <label>
                        <span className="mb-2 block text-sm font-medium text-ink">排序</span>
                        <Input type="number" value={aliasForm.sortOrder} onChange={(event) => setAliasForm((prev) => ({ ...prev, sortOrder: event.target.value }))} />
                      </label>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button onClick={() => void handleAliasSubmit()} disabled={aliasSaving}>{aliasSaving ? '保存中...' : '保存别名'}</Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setSelectedAlias(null);
                          setAliasForm(emptyAliasForm);
                        }}
                      >
                        清空表单
                      </Button>
                    </div>
                  </div>

                  <AdminTable
                    headers={['别名', '标准化预览', '匹配方式', '状态', '来源', '排序', '更新时间', '操作']}
                    hasData={aliasData.list.length > 0}
                    emptyText={aliasLoading ? '正在加载别名...' : '当前标准词暂无别名'}
                  >
                    {aliasData.list.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-4 py-3 font-semibold text-ink">{item.aliasName}</td>
                        <td className="px-4 py-3 text-slate-600">{item.aliasNormalized}</td>
                        <td className="px-4 py-3 text-slate-600">{item.matchMode}</td>
                        <td className="px-4 py-3 text-slate-600">{item.status === 'active' ? '启用' : '停用'}</td>
                        <td className="px-4 py-3 text-slate-600">{item.source || '-'}</td>
                        <td className="px-4 py-3 text-slate-600">{item.sortOrder}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(item.updatedAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <Button
                              variant="secondary"
                              onClick={() => {
                                setSelectedAlias(item);
                                setAliasForm(buildAliasForm(item));
                              }}
                            >
                              编辑
                            </Button>
                            <Button variant="ghost" disabled={aliasDeleting} onClick={() => void handleDeleteAlias(item)}>删除</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </AdminTable>
                </div>
              </>
            )}
          </div>
        </div>
      </ModalShell>

      <ModalShell
        open={hierarchyModalOpen}
        title={selectedHierarchy ? '编辑省市关系' : '新增省市关系'}
        description="省份必须来自 LOCATION 域下的 province 词条，城市必须来自 LOCATION 域下的 city 词条；同一城市只能绑定一个父级省份。"
        onClose={closeHierarchyModal}
        widthClass="max-w-3xl"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label>
            <span className="mb-2 block text-sm font-medium text-ink">省份</span>
            <Select value={hierarchyForm.provinceTermId} onChange={(event) => setHierarchyForm((prev) => ({ ...prev, provinceTermId: event.target.value }))}>
              <option value="">请选择省份</option>
              {provinceOptions.map((item) => <option key={item.id} value={item.id}>{item.canonicalName}</option>)}
            </Select>
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium text-ink">城市</span>
            <Select value={hierarchyForm.cityTermId} onChange={(event) => setHierarchyForm((prev) => ({ ...prev, cityTermId: event.target.value }))}>
              <option value="">请选择城市</option>
              {cityOptions.map((item) => <option key={item.id} value={item.id}>{item.canonicalName}</option>)}
            </Select>
          </label>
          <label className="md:col-span-2">
            <span className="mb-2 block text-sm font-medium text-ink">状态</span>
            <Select value={hierarchyForm.status} onChange={(event) => setHierarchyForm((prev) => ({ ...prev, status: event.target.value as HierarchyFormState['status'] }))}>
              {statusOptions.filter((item) => item.value).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </Select>
          </label>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={() => void handleHierarchySubmit()} disabled={hierarchySaving}>{hierarchySaving ? '保存中...' : '保存关系'}</Button>
          <Button variant="secondary" onClick={closeHierarchyModal}>取消</Button>
          {selectedHierarchy ? (
            <Button variant="ghost" onClick={() => void handleDeleteHierarchy()} disabled={hierarchyDeleting}>{hierarchyDeleting ? '删除中...' : '删除关系'}</Button>
          ) : null}
        </div>
      </ModalShell>
    </div>
  );
}
