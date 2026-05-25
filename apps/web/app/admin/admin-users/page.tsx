'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { AdminTable } from '@/components/admin/admin-table';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { buildQuery } from '@/lib/admin';
import { clientFetch } from '@/lib/api';
import { ADMIN_TOAST_COPY } from '@/lib/toast-copy';
import { formatDate } from '@/lib/utils';
import { useGlobalToast } from '@/store/toast-store';
import { AdminListResponse, AdminManagedRoleItem, AdminManagedUserItem } from '@/types';

const initialFilters = {
  keyword: '',
  status: '',
};

const emptyForm = {
  username: '',
  password: '',
  realName: '',
  phone: '',
  email: '',
  status: 'active',
  remark: '',
  roleIds: [] as string[],
};

export default function AdminManagedUsersPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState<AdminListResponse<AdminManagedUserItem>>({
    list: [],
    pagination: { page: 1, limit: 10, total: 0, hasMore: false },
  });
  const [roles, setRoles] = useState<AdminManagedRoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(emptyForm);

  useGlobalToast(message, setMessage);

  const selectedUser = useMemo(() => data.list.find((item) => item.id === selectedId) ?? null, [data.list, selectedId]);

  const loadData = async (page = 1, nextFilters = filters) => {
    try {
      setLoading(true);
      const [userResult, roleResult] = await Promise.all([
        clientFetch<AdminListResponse<AdminManagedUserItem>>(`/admin/admin-users?${buildQuery({ ...nextFilters, page, limit: 10 })}`),
        clientFetch<AdminListResponse<AdminManagedRoleItem>>(`/admin/admin-roles?${buildQuery({ page: 1, limit: 200, status: 'active' })}`),
      ]);
      setData(userResult);
      setRoles(roleResult.list);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.loadFailed('后台账号'));
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void loadData(1, filters);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fillForm = (item: AdminManagedUserItem) => {
    setSelectedId(item.id);
    setForm({
      username: item.username,
      password: '',
      realName: item.realName || '',
      phone: item.phone || '',
      email: item.email || '',
      status: item.status,
      remark: item.remark || '',
      roleIds: item.roleIds,
    });
  };

  const resetForm = () => {
    setSelectedId('');
    setForm(emptyForm);
  };

  const toggleRole = (roleId: string) => {
    setForm((prev) => ({
      ...prev,
      roleIds: prev.roleIds.includes(roleId) ? prev.roleIds.filter((item) => item !== roleId) : [...prev.roleIds, roleId],
    }));
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      const payload = {
        username: form.username,
        password: form.password,
        realName: form.realName,
        phone: form.phone,
        email: form.email,
        status: form.status,
        remark: form.remark,
        roleIds: form.roleIds,
      };
      const result = selectedId
        ? await clientFetch<AdminManagedUserItem>(`/admin/admin-users/${selectedId}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await clientFetch<AdminManagedUserItem>('/admin/admin-users', { method: 'POST', body: JSON.stringify(payload) });
      setMessage(selectedId ? ADMIN_TOAST_COPY.updated('后台账号') : ADMIN_TOAST_COPY.created('后台账号'));
      fillForm(result);
      await loadData(selectedId ? data.pagination.page : 1, filters);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.saveFailed('后台账号'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!window.confirm('确认删除当前后台账号吗？')) return;
    try {
      await clientFetch(`/admin/admin-users/${selectedId}`, { method: 'DELETE' });
      setMessage(ADMIN_TOAST_COPY.deleted('后台账号'));
      resetForm();
      await loadData(1, filters);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.deleteFailed('后台账号'));
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Admin managed users</p>
        <div className="mt-2 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-ink">后台账号管理</h2>
            <p className="mt-2 text-sm text-muted">集中维护后台登录账号、角色绑定、启停状态与备注信息，支撑后台治理能力。</p>
          </div>
          <Button onClick={resetForm}>新增后台账号</Button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <Card className="rounded-3xl p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Input placeholder="搜索账号 / 姓名 / 手机 / 邮箱" value={filters.keyword} onChange={(e) => setFilters((prev) => ({ ...prev, keyword: e.target.value }))} />
              <Select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
                <option value="">全部状态</option>
                <option value="active">启用中</option>
                <option value="inactive">已停用</option>
              </Select>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => void loadData(1, filters)}>搜索</Button>
                <Button className="flex-1" variant="secondary" onClick={() => { setFilters(initialFilters); resetForm(); void loadData(1, initialFilters); }}>重置</Button>
              </div>
            </div>
          </Card>

          <AdminTable headers={['账号', '姓名', '状态', '角色', '最后登录', '创建时间']} hasData={data.list.length > 0} emptyText={loading ? '后台账号加载中...' : '暂无后台账号'}>
            {data.list.map((item) => (
              <tr
                key={item.id}
                className={`cursor-pointer border-b border-slate-100 last:border-b-0 ${selectedId === item.id ? 'bg-brand/5' : 'hover:bg-slate-50'}`}
                onClick={() => fillForm(item)}
              >
                <td className="px-4 py-3 font-medium text-ink">{item.username}</td>
                <td className="px-4 py-3 text-slate-600">{item.realName || '-'}</td>
                <td className="px-4 py-3 text-slate-600">{item.status === 'active' ? '启用中' : '已停用'}</td>
                <td className="px-4 py-3 text-slate-600">{item.roles.map((role) => role.name).join('、') || '-'}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(item.lastLoginAt)}</td>
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
        </div>

        <Card className="rounded-3xl p-5 xl:sticky xl:top-6 xl:self-start">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-ink">{selectedUser ? '编辑后台账号' : '新增后台账号'}</h3>
              <p className="mt-1 text-sm text-muted">创建时必须设置密码；编辑时密码留空表示保持不变。</p>
            </div>
            {selectedUser ? <Button variant="ghost" onClick={resetForm}>切换新增</Button> : null}
          </div>

          <div className="mt-5 space-y-4">
            <Input placeholder="登录账号" value={form.username} onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))} />
            <Input type="text" placeholder={selectedUser ? '留空则不修改密码' : '登录密码'} value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} />
            <Input placeholder="姓名" value={form.realName} onChange={(e) => setForm((prev) => ({ ...prev, realName: e.target.value }))} />
            <Input placeholder="手机号" value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
            <Input placeholder="邮箱" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
            <Select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
              <option value="active">启用中</option>
              <option value="inactive">已停用</option>
            </Select>
            <Textarea placeholder="账号备注" value={form.remark} onChange={(e) => setForm((prev) => ({ ...prev, remark: e.target.value }))} className="min-h-[96px]" />
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-ink">角色绑定</p>
            <div className="mt-3 space-y-3">
              {roles.map((role) => (
                <label key={role.id} className="flex cursor-pointer items-start gap-3 rounded-2xl bg-white px-3 py-3 text-sm text-slate-600 shadow-sm">
                  <input type="checkbox" checked={form.roleIds.includes(role.id)} onChange={() => toggleRole(role.id)} className="mt-1 h-4 w-4" />
                  <div>
                    <p className="font-medium text-ink">{role.name}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{role.code} · {role.permissions.map((item) => item.name).join('、') || '暂无权限'}</p>
                  </div>
                </label>
              ))}
              {!roles.length ? <p className="text-sm text-slate-500">暂无可绑定角色，请先创建角色。</p> : null}
            </div>
          </div>

          {selectedUser ? (
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <p>当前权限：{selectedUser.permissions.join('、') || '暂无'}</p>
              <p className="mt-1">超级管理员：{selectedUser.isSuperAdmin ? '是' : '否'}</p>
              <p className="mt-1">最后登录：{formatDate(selectedUser.lastLoginAt)}</p>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <Button className="flex-1" onClick={handleSubmit} disabled={saving}>{saving ? '保存中...' : '保存后台账号'}</Button>
            {selectedUser ? <Button className="flex-1" variant="secondary" onClick={handleDelete}>删除账号</Button> : null}
          </div>
        </Card>
      </section>
    </div>
  );
}
