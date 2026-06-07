'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { DEGREE_OPTIONS } from '@offer360/shared';
import { AdminModal } from '@/components/admin/admin-modal';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { AdminTable } from '@/components/admin/admin-table';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { buildQuery, downloadFilePayload, splitInputTags } from '@/lib/admin';
import { clientFetch } from '@/lib/api';
import { ADMIN_TOAST_COPY } from '@/lib/toast-copy';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useGlobalToast } from '@/store/toast-store';
import { AdminFileDownloadPayload, AdminImportResult, AdminListResponse, AdminUserItem } from '@/types';

const initialFilters = {
  keyword: '',
  membershipStatus: '',
  status: '',
};

const emptyForm = {
  phone: '',
  password: '',
  name: '',
  graduationYear: '2026',
  degree: '本科',
  schoolName: '',
  major: '',
  parentInviteCode: '',
  status: 'active',
  intentionCityText: '',
  intentionJobText: '',
  intentionCompanyText: '',
};

export default function AdminUsersPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState<AdminListResponse<AdminUserItem>>({
    list: [],
    pagination: { page: 1, limit: 10, total: 0, hasMore: false },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [passwordResetting, setPasswordResetting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [resetPassword, setResetPassword] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const [importCsvText, setImportCsvText] = useState('');
  const [importResult, setImportResult] = useState<AdminImportResult | null>(null);

  useGlobalToast(message, setMessage);

  const importInputRef = useRef<HTMLInputElement | null>(null);
  const page = data.pagination.page || 1;
  const selectedUser = useMemo(() => data.list.find((item) => item.id === selectedId) ?? null, [data.list, selectedId]);

  const loadData = async (nextPage = page, nextFilters = filters) => {
    try {
      setLoading(true);
      const queryString = buildQuery({ ...nextFilters, page: nextPage, limit: 10 });
      const result = await clientFetch<AdminListResponse<AdminUserItem>>(`/admin/users?${queryString}`);
      setData(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.loadFailed('用户数据'));
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void loadData(1, filters);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fillForm = (item: AdminUserItem) => {
    setSelectedId(item.id);
    setResetPassword('');
    setForm({
      phone: item.phone,
      password: '',
      name: item.profile?.name || '',
      graduationYear: String(item.profile?.graduationYear || 2026),
      degree: item.profile?.degree || '本科',
      schoolName: item.profile?.schoolName || '',
      major: item.profile?.major || '',
      parentInviteCode: item.parentInviteCode || '',
      status: item.status || 'active',
      intentionCityText: item.preference.intentionCity.join('，'),
      intentionJobText: item.preference.intentionJob.join('，'),
      intentionCompanyText: item.preference.intentionCompany.join('，'),
    });
  };

  const openCreateModal = () => {
    resetForm();
    setEditorOpen(true);
  };

  const openEditModal = (item: AdminUserItem) => {
    fillForm(item);
    setEditorOpen(true);
  };

  const closeEditorModal = () => {
    setEditorOpen(false);
  };

  const resetForm = () => {
    setSelectedId('');
    setResetPassword('');
    setForm(emptyForm);
  };

  const clearImportSelection = () => {
    setImportFileName('');
    setImportCsvText('');
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
      const payload = {
        phone: form.phone,
        password: form.password,
        name: form.name,
        graduationYear: Number(form.graduationYear),
        degree: form.degree,
        schoolName: form.schoolName,
        major: form.major,
        parentInviteCode: form.parentInviteCode,
        status: form.status,
        intentionCity: splitInputTags(form.intentionCityText),
        intentionJob: splitInputTags(form.intentionJobText),
        intentionCompany: splitInputTags(form.intentionCompanyText),
      };
      const result = selectedId
        ? await clientFetch<AdminUserItem>(`/admin/users/${selectedId}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await clientFetch<AdminUserItem>('/admin/users', { method: 'POST', body: JSON.stringify(payload) });
      setMessage(selectedId ? ADMIN_TOAST_COPY.updated('用户信息') : ADMIN_TOAST_COPY.created('用户'));
      fillForm(result);
      await loadData(selectedId ? page : 1, filters);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.saveFailed('用户'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!window.confirm('确认删除当前用户吗？删除后关联资料和会员记录会一起清除。')) return;
    try {
      await clientFetch(`/admin/users/${selectedId}`, { method: 'DELETE' });
      setMessage(ADMIN_TOAST_COPY.deleted('用户'));
      resetForm();
      closeEditorModal();
      await loadData(1, filters);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.deleteFailed('用户'));
    }
  };

  const handleUpdateUserStatus = async (status: 'active' | 'inactive') => {
    if (!selectedUser) return;
    try {
      setStatusSaving(true);
      const result = await clientFetch<{ status: string; user: AdminUserItem }>(`/admin/users/${selectedUser.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setMessage(status === 'active' ? ADMIN_TOAST_COPY.enabled('用户') : ADMIN_TOAST_COPY.disabled('用户'));
      fillForm(result.user);
      await loadData(page, filters);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.statusUpdateFailed('用户'));
    } finally {
      setStatusSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;
    if (!resetPassword.trim()) {
      setMessage(ADMIN_TOAST_COPY.passwordRequired);
      return;
    }

    try {
      setPasswordResetting(true);
      await clientFetch(`/admin/users/${selectedUser.id}/reset-password`, {
        method: 'PATCH',
        body: JSON.stringify({ newPassword: resetPassword.trim() }),
      });
      setMessage(ADMIN_TOAST_COPY.passwordResetDone);
      setResetPassword('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.operationFailed('用户密码重置'));
    } finally {
      setPasswordResetting(false);
    }
  };

  const handleTemplateDownload = async () => {
    try {
      setDownloadingTemplate(true);
      const payload = await clientFetch<AdminFileDownloadPayload>('/admin/users/template');
      downloadFilePayload(payload);
      setMessage(ADMIN_TOAST_COPY.templateDownloaded('用户导入'));
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
      const payload = await clientFetch<AdminFileDownloadPayload>(`/admin/users/export${queryString ? `?${queryString}` : ''}`);
      downloadFilePayload(payload);
      setMessage(ADMIN_TOAST_COPY.exportDone('用户筛选结果'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.exportFailed('用户数据'));
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

    try {
      const text = await file.text();
      setImportFileName(file.name);
      setImportCsvText(text);
      setImportResult(null);
      setMessage(ADMIN_TOAST_COPY.fileLoaded(file.name));
    } catch {
      clearImportSelection();
      setMessage('读取导入文件失败，请重新选择 CSV 文件');
    }
  };

  const handleImportSubmit = async () => {
    if (!importCsvText.trim()) {
      setMessage(ADMIN_TOAST_COPY.templateFileRequired('CSV 文件'));
      return;
    }

    try {
      setImporting(true);
      const result = await clientFetch<AdminImportResult>('/admin/users/import', {
        method: 'POST',
        body: JSON.stringify({ csvText: importCsvText }),
      });
      setImportResult(result);
      setMessage(ADMIN_TOAST_COPY.importCompleted(result.total, result.success, result.failed));
      await loadData(1, filters);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.operationFailed('用户导入'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Admin users</p>
        <div className="mt-2 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-ink">用户管理</h2>
            <p className="mt-2 text-sm text-muted">集中处理账号、资料、意向标签与邀请关系，并直接执行冻结、恢复、重置密码等运营动作。</p>
          </div>
          <Button onClick={openCreateModal}>新增用户</Button>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-ink">批量工具</h3>
            <p className="mt-1 text-sm text-muted">用户模板、导出、导入全部走后台服务端规则，确保新增账号、意向标签和邀请关系字段统一。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void handleTemplateDownload()} disabled={downloadingTemplate}>
              {downloadingTemplate ? '模板下载中...' : '下载导入模板'}
            </Button>
            <Button variant="secondary" onClick={() => void handleExport()} disabled={exporting}>
              {exporting ? '导出中...' : '导出筛选结果'}
            </Button>
            <Button variant="secondary" onClick={() => importInputRef.current?.click()}>
              {importFileName ? '重新选择文件' : '选择 CSV 文件'}
            </Button>
            <Button onClick={() => void handleImportSubmit()} disabled={importing}>
              {importing ? '导入中...' : '开始导入'}
            </Button>
          </div>
        </div>
        <input ref={importInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportFileChange} />

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-semibold text-ink">当前导入文件</p>
            <p className="mt-2">{importFileName || '暂未选择文件'}</p>
            <p className="mt-3 text-xs leading-6 text-slate-500">推荐先下载模板后再填写，保持列头为：手机号、初始密码、姓名、毕业年份、学历、学校、专业、上级邀请码、意向城市、意向岗位、意向公司、用户状态、来源类型。</p>
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
              <p className="mt-2 text-slate-500">选择 CSV 并执行导入后，这里会展示服务端校验结果。</p>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <Card className="rounded-3xl p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Input placeholder="搜索手机号 / 姓名 / 邀请码" value={filters.keyword} onChange={(e) => setFilters((prev) => ({ ...prev, keyword: e.target.value }))} />
            <Select value={filters.membershipStatus} onChange={(e) => setFilters((prev) => ({ ...prev, membershipStatus: e.target.value }))}>
              <option value="">全部会员状态</option>
              <option value="member">会员用户</option>
              <option value="non-member">非会员用户</option>
            </Select>
            <Select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
              <option value="">全部用户状态</option>
              <option value="active">启用中</option>
              <option value="inactive">已冻结</option>
            </Select>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => void loadData(1, filters)}>搜索</Button>
              <Button className="flex-1" variant="secondary" onClick={() => void handleReset()}>重置</Button>
            </div>
          </div>
        </Card>

        <AdminTable headers={['手机号', '姓名', '邀请码', '用户状态', '会员类型 / 剩余时长', '钱包余额', '注册时间']} hasData={data.list.length > 0} emptyText={loading ? '用户数据加载中...' : '暂无用户数据'}>
          {data.list.map((item) => (
            <tr
              key={item.id}
              className={`cursor-pointer border-b border-slate-100 last:border-b-0 ${selectedId === item.id ? 'bg-brand/5' : 'hover:bg-slate-50'}`}
              onClick={() => openEditModal(item)}
            >
              <td className="px-4 py-3 font-medium text-ink">{item.phone}</td>
              <td className="px-4 py-3 text-slate-600">{item.profile?.name || '-'}</td>
              <td className="px-4 py-3 text-slate-600">{item.inviteCode}</td>
              <td className="px-4 py-3 text-slate-600">{item.status === 'active' ? '启用中' : '已冻结'}</td>
              <td className="px-4 py-3 text-slate-600">
                {!item.membership
                  ? '非会员'
                  : item.membership.isActive
                    ? `${item.membership.memberLevelLabel} · 剩余 ${item.membership.remainingDays} 天`
                    : `${item.membership.memberLevelLabel} · 已过期`}
              </td>
              <td className="px-4 py-3 text-slate-600">{formatCurrency(item.wallet?.availableBalance ?? 0)}</td>
              <td className="px-4 py-3 text-slate-600">{formatDate(item.createdAt)}</td>
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
        title={selectedUser ? '编辑用户' : '新增用户'}
        description="密码字段仅在新增或需要重置密码时填写。"
        onClose={closeEditorModal}
      >
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-muted">弹窗内展示完整用户表单，避免右侧固定列挤压字段。</div>
            {selectedUser ? <Button variant="ghost" onClick={openCreateModal}>切换新增</Button> : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Input placeholder="手机号" value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
            <Input type="text" placeholder={selectedUser ? '留空则不修改密码' : '初始密码'} value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} />
            <Input placeholder="姓名" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
            <Input type="number" placeholder="毕业年份" value={form.graduationYear} onChange={(e) => setForm((prev) => ({ ...prev, graduationYear: e.target.value }))} />
            <Select value={form.degree} onChange={(e) => setForm((prev) => ({ ...prev, degree: e.target.value }))}>
              {DEGREE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
            <Select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
              <option value="active">启用中</option>
              <option value="inactive">已冻结</option>
            </Select>
            <Input placeholder="毕业学校" value={form.schoolName} onChange={(e) => setForm((prev) => ({ ...prev, schoolName: e.target.value }))} />
            <Input placeholder="专业" value={form.major} onChange={(e) => setForm((prev) => ({ ...prev, major: e.target.value }))} />
            <Input className="lg:col-span-2" placeholder="上级邀请码（可选）" value={form.parentInviteCode} onChange={(e) => setForm((prev) => ({ ...prev, parentInviteCode: e.target.value }))} />
            <Input className="lg:col-span-2" placeholder="意向城市，多个用逗号分隔" value={form.intentionCityText} onChange={(e) => setForm((prev) => ({ ...prev, intentionCityText: e.target.value }))} />
            <Input className="lg:col-span-2" placeholder="意向岗位，多个用逗号分隔" value={form.intentionJobText} onChange={(e) => setForm((prev) => ({ ...prev, intentionJobText: e.target.value }))} />
            <Input className="lg:col-span-2" placeholder="意向公司，多个用逗号分隔" value={form.intentionCompanyText} onChange={(e) => setForm((prev) => ({ ...prev, intentionCompanyText: e.target.value }))} />
          </div>

          {selectedUser ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <p>邀请码：{selectedUser.inviteCode}</p>
                <p className="mt-1">上级用户：{selectedUser.parentPhone || '暂无'}</p>
                <p className="mt-1">用户状态：{selectedUser.status === 'active' ? '启用中' : '已冻结'}</p>
                <p className="mt-1">来源类型：{selectedUser.sourceType || '未记录'}</p>
                <p className="mt-1">最后登录：{formatDate(selectedUser.lastLoginAt)}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-ink">运营动作</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Button variant="secondary" onClick={() => void handleUpdateUserStatus(selectedUser.status === 'active' ? 'inactive' : 'active')} disabled={statusSaving}>
                    {statusSaving ? '处理中...' : selectedUser.status === 'active' ? '冻结账号' : '恢复账号'}
                  </Button>
                  <Button variant="secondary" onClick={handleDelete}>删除账号</Button>
                </div>
                <div className="mt-4 space-y-2">
                  <Input type="text" placeholder="输入新密码后点击重置" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} />
                  <Button className="w-full" onClick={() => void handleResetPassword()} disabled={passwordResetting}>
                    {passwordResetting ? '重置中...' : '重置登录密码'}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={closeEditorModal}>取消</Button>
            <Button onClick={handleSubmit} disabled={saving}>{saving ? '保存中...' : '保存用户'}</Button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
