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
import { formatDate } from '@/lib/utils';
import { useGlobalToast } from '@/store/toast-store';
import { AdminListResponse, AdminManagedRoleItem, AdminPermissionCatalogItem } from '@/types';

const initialFilters = {
  keyword: '',
  status: '',
};

const emptyForm = {
  code: '',
  name: '',
  description: '',
  status: 'active',
  permissionKeys: [] as string[],
};

export default function AdminRolesPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState<AdminListResponse<AdminManagedRoleItem>>({
    list: [],
    pagination: { page: 1, limit: 10, total: 0, hasMore: false },
  });
  const [catalog, setCatalog] = useState<AdminPermissionCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(emptyForm);

  useGlobalToast(message, setMessage);

  const selectedRole = useMemo(() => data.list.find((item) => item.id === selectedId) ?? null, [data.list, selectedId]);
  const groupedCatalog = useMemo(() => {
    return catalog.reduce<Record<string, AdminPermissionCatalogItem[]>>((accumulator, item) => {
      if (!accumulator[item.group]) {
        accumulator[item.group] = [];
      }
      accumulator[item.group].push(item);
      return accumulator;
    }, {});
  }, [catalog]);

  const loadData = async (page = 1, nextFilters = filters) => {
    try {
      setLoading(true);
      const [roleResult, permissionResult] = await Promise.all([
        clientFetch<AdminListResponse<AdminManagedRoleItem>>(`/admin/admin-roles?${buildQuery({ ...nextFilters, page, limit: 10 })}`),
        clientFetch<AdminPermissionCatalogItem[]>('/admin/permission-catalog'),
      ]);
      setData(roleResult);
      setCatalog(permissionResult);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '角色权限加载失败');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void loadData(1, filters);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fillForm = (item: AdminManagedRoleItem) => {
    setSelectedId(item.id);
    setForm({
      code: item.code,
      name: item.name,
      description: item.description || '',
      status: item.status,
      permissionKeys: item.permissionKeys,
    });
  };

  const resetForm = () => {
    setSelectedId('');
    setForm(emptyForm);
  };

  const togglePermission = (permissionKey: string) => {
    setForm((prev) => ({
      ...prev,
      permissionKeys: prev.permissionKeys.includes(permissionKey)
        ? prev.permissionKeys.filter((item) => item !== permissionKey)
        : [...prev.permissionKeys, permissionKey],
    }));
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      const payload = {
        code: form.code,
        name: form.name,
        description: form.description,
        status: form.status,
        permissionKeys: form.permissionKeys,
      };
      const result = selectedId
        ? await clientFetch<AdminManagedRoleItem>(`/admin/admin-roles/${selectedId}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await clientFetch<AdminManagedRoleItem>('/admin/admin-roles', { method: 'POST', body: JSON.stringify(payload) });
      setMessage(selectedId ? '角色已更新' : '角色已创建');
      fillForm(result);
      await loadData(selectedId ? data.pagination.page : 1, filters);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '角色保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!window.confirm('确认删除当前角色吗？')) return;
    try {
      await clientFetch(`/admin/admin-roles/${selectedId}`, { method: 'DELETE' });
      setMessage('角色已删除');
      resetForm();
      await loadData(1, filters);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '角色删除失败');
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Admin roles</p>
        <div className="mt-2 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-ink">角色权限管理</h2>
            <p className="mt-2 text-sm text-muted">配置后台角色、权限组合和启停状态，为后台账号提供可治理的授权体系。</p>
          </div>
          <Button onClick={resetForm}>新增角色</Button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_460px]">
        <div className="space-y-4">
          <Card className="rounded-3xl p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Input placeholder="搜索角色编码 / 名称 / 描述" value={filters.keyword} onChange={(e) => setFilters((prev) => ({ ...prev, keyword: e.target.value }))} />
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

          <AdminTable headers={['角色名称', '编码', '状态', '绑定账号数', '更新时间']} hasData={data.list.length > 0} emptyText={loading ? '角色数据加载中...' : '暂无角色数据'}>
            {data.list.map((item) => (
              <tr
                key={item.id}
                className={`cursor-pointer border-b border-slate-100 last:border-b-0 ${selectedId === item.id ? 'bg-brand/5' : 'hover:bg-slate-50'}`}
                onClick={() => fillForm(item)}
              >
                <td className="px-4 py-3 font-medium text-ink">{item.name}</td>
                <td className="px-4 py-3 text-slate-600">{item.code}</td>
                <td className="px-4 py-3 text-slate-600">{item.status === 'active' ? '启用中' : '已停用'}</td>
                <td className="px-4 py-3 text-slate-600">{item.userCount}</td>
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
              <h3 className="text-xl font-semibold text-ink">{selectedRole ? '编辑角色' : '新增角色'}</h3>
              <p className="mt-1 text-sm text-muted">角色编码建议使用英文短词，权限选择会直接影响左侧菜单和接口访问。</p>
            </div>
            {selectedRole ? <Button variant="ghost" onClick={resetForm}>切换新增</Button> : null}
          </div>

          <div className="mt-5 space-y-4">
            <Input placeholder="角色编码，如 operation-manager" value={form.code} onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))} />
            <Input placeholder="角色名称" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
            <Textarea placeholder="角色描述" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} className="min-h-[96px]" />
            <Select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
              <option value="active">启用中</option>
              <option value="inactive">已停用</option>
            </Select>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-ink">权限配置</p>
            <div className="mt-4 space-y-4">
              {Object.entries(groupedCatalog).map(([group, items]) => (
                <div key={group}>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{group}</p>
                  <div className="mt-2 space-y-2">
                    {items.map((item) => (
                      <label key={item.key} className="flex cursor-pointer items-start gap-3 rounded-2xl bg-white px-3 py-3 text-sm text-slate-600 shadow-sm">
                        <input type="checkbox" checked={form.permissionKeys.includes(item.key)} onChange={() => togglePermission(item.key)} className="mt-1 h-4 w-4" />
                        <div>
                          <p className="font-medium text-ink">{item.name}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">{item.key}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selectedRole ? (
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <p>当前绑定账号数：{selectedRole.userCount}</p>
              <p className="mt-1">最近更新时间：{formatDate(selectedRole.updatedAt)}</p>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <Button className="flex-1" onClick={handleSubmit} disabled={saving}>{saving ? '保存中...' : '保存角色'}</Button>
            {selectedRole ? <Button className="flex-1" variant="secondary" onClick={handleDelete}>删除角色</Button> : null}
          </div>
        </Card>
      </section>
    </div>
  );
}
