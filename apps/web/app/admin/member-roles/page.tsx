'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminTable } from '@/components/admin/admin-table';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { clientFetch } from '@/lib/api';
import { ADMIN_TOAST_COPY } from '@/lib/toast-copy';
import { formatDate } from '@/lib/utils';
import { useGlobalToast } from '@/store/toast-store';
import { AdminMemberRoleItem, AdminPermissionCatalogItem } from '@/types';

export default function AdminMemberRolesPage() {
  const [roles, setRoles] = useState<AdminMemberRoleItem[]>([]);
  const [catalog, setCatalog] = useState<AdminPermissionCatalogItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [description, setDescription] = useState('');
  const [permissionKeys, setPermissionKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useGlobalToast(message, setMessage);

  const selectedRole = useMemo(() => roles.find((item) => item.id === selectedId) ?? null, [roles, selectedId]);
  const groupedCatalog = useMemo(() => {
    return catalog.reduce<Record<string, AdminPermissionCatalogItem[]>>((accumulator, item) => {
      if (!accumulator[item.group]) {
        accumulator[item.group] = [];
      }
      accumulator[item.group].push(item);
      return accumulator;
    }, {});
  }, [catalog]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [roleResult, permissionResult] = await Promise.all([
        clientFetch<AdminMemberRoleItem[]>('/admin/member-roles'),
        clientFetch<AdminPermissionCatalogItem[]>('/admin/member-permission-catalog'),
      ]);
      setRoles(roleResult);
      setCatalog(permissionResult);
      if (!selectedId && roleResult.length) {
        const next = roleResult[0];
        setSelectedId(next.id);
        setDescription(next.description || '');
        setPermissionKeys(next.permissionKeys);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.loadFailed('会员角色配置'));
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fillForm = (item: AdminMemberRoleItem) => {
    setSelectedId(item.id);
    setDescription(item.description || '');
    setPermissionKeys(item.permissionKeys);
  };

  const togglePermission = (permissionKey: string) => {
    setPermissionKeys((prev) =>
      prev.includes(permissionKey) ? prev.filter((item) => item !== permissionKey) : [...prev, permissionKey],
    );
  };

  const handleSubmit = async () => {
    if (!selectedRole) return;
    try {
      setSaving(true);
      const result = await clientFetch<AdminMemberRoleItem>(`/admin/member-roles/${selectedRole.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ description, permissionKeys }),
      });
      setRoles((prev) => prev.map((item) => (item.id === result.id ? result : item)));
      fillForm(result);
      setMessage(ADMIN_TOAST_COPY.updated('会员角色权限'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.saveFailed('会员角色'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Member roles</p>
        <div className="mt-2 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-ink">C 端会员角色权限</h2>
            <p className="mt-2 text-sm text-muted">维护免费用户、标准会员、超级会员三套系统角色的直接权限；继承权限会自动联动展示。</p>
          </div>
          <Button variant="secondary" onClick={() => void loadData()} disabled={loading}>
            刷新数据
          </Button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_460px]">
        <div className="space-y-4">
          <AdminTable
            headers={['角色名称', '编码', '继承来源', '用户数', '状态', '更新时间']}
            hasData={roles.length > 0}
            emptyText={loading ? '会员角色加载中...' : '暂无会员角色数据'}
          >
            {roles.map((item) => (
              <tr
                key={item.id}
                className={`cursor-pointer border-b border-slate-100 last:border-b-0 ${selectedId === item.id ? 'bg-brand/5' : 'hover:bg-slate-50'}`}
                onClick={() => fillForm(item)}
              >
                <td className="px-4 py-3 font-medium text-ink">{item.name}</td>
                <td className="px-4 py-3 text-slate-600">{item.code}</td>
                <td className="px-4 py-3 text-slate-600">{item.inheritedRoleCode || '无'}</td>
                <td className="px-4 py-3 text-slate-600">{item.userCount}</td>
                <td className="px-4 py-3 text-slate-600">{item.status === 'active' ? '启用中' : item.status}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(item.updatedAt || item.createdAt || undefined)}</td>
              </tr>
            ))}
          </AdminTable>
        </div>

        <Card className="rounded-3xl p-5 xl:sticky xl:top-6 xl:self-start">
          {selectedRole ? (
            <>
              <div>
                <h3 className="text-xl font-semibold text-ink">编辑 {selectedRole.name}</h3>
                <p className="mt-1 text-sm text-muted">系统角色编码与继承链固定不可改；这里只维护描述与当前角色的直接权限。</p>
              </div>

              <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <p>角色编码：{selectedRole.code}</p>
                <p className="mt-1">继承来源：{selectedRole.inheritedRoleCode || '无'}</p>
                <p className="mt-1">当前用户数：{selectedRole.userCount}</p>
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-sm font-medium text-ink">角色说明</label>
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="min-h-[96px]"
                  placeholder="补充当前会员角色的业务说明"
                />
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-ink">权限配置</p>
                <div className="mt-4 space-y-4">
                  {Object.entries(groupedCatalog).map(([group, items]) => (
                    <div key={group}>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{group}</p>
                      <div className="mt-2 space-y-2">
                        {items.map((item) => {
                          const permissionMeta = selectedRole.permissions.find((permission) => permission.key === item.key);
                          const checked = permissionKeys.includes(item.key) || Boolean(permissionMeta?.inherited);
                          const inherited = Boolean(permissionMeta?.inherited);
                          return (
                            <label
                              key={item.key}
                              className="flex cursor-pointer items-start gap-3 rounded-2xl bg-white px-3 py-3 text-sm text-slate-600 shadow-sm"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={inherited}
                                onChange={() => togglePermission(item.key)}
                                className="mt-1 h-4 w-4"
                              />
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-medium text-ink">{item.name}</p>
                                  {inherited ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-600">继承权限</span> : null}
                                </div>
                                <p className="mt-1 text-xs leading-5 text-slate-500">{item.key}</p>
                                {item.description ? <p className="mt-1 text-xs leading-5 text-slate-400">{item.description}</p> : null}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex gap-2">
                <Button className="flex-1" onClick={() => void handleSubmit()} disabled={saving}>
                  {saving ? '保存中...' : '保存会员角色'}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">请先从左侧选择一条会员角色记录。</p>
          )}
        </Card>
      </section>
    </div>
  );
}
