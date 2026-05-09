'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { AdminTable } from '@/components/admin/admin-table';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { buildQuery, toDateInputValue } from '@/lib/admin';
import { clientFetch } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { useGlobalToast } from '@/store/toast-store';
import { AdminListResponse, AdminMembershipItem, MemberLevel } from '@/types';

const initialFilters = {
  keyword: '',
  status: '',
  memberLevel: '',
};

const emptyForm = {
  userPhone: '',
  memberLevel: 'standard' as MemberLevel,
  days: '180',
  startAt: '',
  endAt: '',
  remainingDays: '',
};

export default function AdminMembershipsPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState<AdminListResponse<AdminMembershipItem>>({
    list: [],
    pagination: { page: 1, limit: 10, total: 0, hasMore: false },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(emptyForm);

  useGlobalToast(message, setMessage);

  const page = data.pagination.page || 1;
  const selectedMembership = useMemo(() => data.list.find((item) => item.id === selectedId) ?? null, [data.list, selectedId]);

  const loadData = async (nextPage = page, nextFilters = filters) => {
    try {
      setLoading(true);
      const result = await clientFetch<AdminListResponse<AdminMembershipItem>>(
        `/admin/memberships?${buildQuery({ ...nextFilters, page: nextPage, limit: 10 })}`,
      );
      setData(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '会员数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void loadData(1, filters);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fillForm = (item: AdminMembershipItem) => {
    setSelectedId(item.id);
    setForm({
      userPhone: item.userPhone,
      memberLevel: item.memberLevel,
      days: '',
      startAt: toDateInputValue(item.startAt),
      endAt: toDateInputValue(item.endAt),
      remainingDays: String(item.remainingDays),
    });
  };

  const resetForm = () => {
    setSelectedId('');
    setForm(emptyForm);
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      const payload = selectedId
        ? {
            memberLevel: form.memberLevel,
            days: form.days ? Number(form.days) : undefined,
            startAt: form.startAt || undefined,
            endAt: form.endAt || undefined,
            remainingDays: form.remainingDays ? Number(form.remainingDays) : undefined,
          }
        : {
            phone: form.userPhone,
            memberLevel: form.memberLevel,
            days: Number(form.days || 180),
          };
      await (selectedId
        ? clientFetch<AdminMembershipItem>(`/admin/memberships/${selectedId}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : clientFetch<AdminMembershipItem>('/admin/memberships', { method: 'POST', body: JSON.stringify(payload) }));
      setMessage(selectedId ? '会员信息已更新' : '会员已开通');
      resetForm();
      await loadData(selectedId ? page : 1, filters);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '会员保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!window.confirm('确认删除该会员记录吗？')) return;
    try {
      await clientFetch(`/admin/memberships/${selectedId}`, { method: 'DELETE' });
      setMessage('会员记录已删除');
      resetForm();
      await loadData(1, filters);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '会员记录删除失败');
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Admin memberships</p>
        <div className="mt-2 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-ink">会员管理</h2>
            <p className="mt-2 text-sm text-muted">支持按手机号检索、区分标准 / 超级会员、手动开通、续期、调整起止时间和删除异常记录。</p>
          </div>
          <Button onClick={resetForm}>手动开通会员</Button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <Card className="rounded-3xl p-4">
            <div className="grid gap-3 md:grid-cols-4">
              <Input placeholder="搜索手机号 / 邀请码" value={filters.keyword} onChange={(e) => setFilters((prev) => ({ ...prev, keyword: e.target.value }))} />
              <Select value={filters.memberLevel} onChange={(e) => setFilters((prev) => ({ ...prev, memberLevel: e.target.value }))}>
                <option value="">全部等级</option>
                <option value="standard">标准会员</option>
                <option value="super">超级会员</option>
              </Select>
              <Select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
                <option value="">全部状态</option>
                <option value="active">有效会员</option>
                <option value="expired">已过期</option>
              </Select>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => void loadData(1, filters)}>搜索</Button>
                <Button className="flex-1" variant="secondary" onClick={() => { setFilters(initialFilters); resetForm(); void loadData(1, initialFilters); }}>重置</Button>
              </div>
            </div>
          </Card>

          <AdminTable
            headers={['手机号', '会员等级', '角色', '剩余天数', '状态', '到期时间', '来源']}
            hasData={data.list.length > 0}
            emptyText={loading ? '会员数据加载中...' : '暂无会员数据'}
          >
            {data.list.map((item) => (
              <tr
                key={item.id}
                className={`cursor-pointer border-b border-slate-100 last:border-b-0 ${selectedId === item.id ? 'bg-brand/5' : 'hover:bg-slate-50'}`}
                onClick={() => fillForm(item)}
              >
                <td className="px-4 py-3 font-medium text-ink">{item.userPhone}</td>
                <td className="px-4 py-3 text-slate-600">{item.memberLevelLabel}</td>
                <td className="px-4 py-3 text-slate-600">{item.memberRoleName}</td>
                <td className="px-4 py-3 text-slate-600">{item.remainingDays}</td>
                <td className="px-4 py-3 text-slate-600">{item.isActive ? '有效' : '已过期'}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(item.endAt)}</td>
                <td className="px-4 py-3 text-slate-600">{item.sourceType || '-'}</td>
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
              <h3 className="text-xl font-semibold text-ink">{selectedMembership ? '编辑会员' : '开通会员'}</h3>
              <p className="mt-1 text-sm text-muted">新增时按手机号开通；编辑时可切换会员等级、补发天数或直接调整日期，剩余时长统一按到期时间实时计算。</p>
            </div>
            {selectedMembership ? <Button variant="ghost" onClick={resetForm}>切换新增</Button> : null}
          </div>

          <div className="mt-5 space-y-4">
            <Input placeholder="用户手机号" value={form.userPhone} disabled={Boolean(selectedMembership)} onChange={(e) => setForm((prev) => ({ ...prev, userPhone: e.target.value }))} />
            <Select value={form.memberLevel} onChange={(e) => setForm((prev) => ({ ...prev, memberLevel: e.target.value as MemberLevel }))}>
              <option value="standard">标准会员</option>
              <option value="super">超级会员</option>
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" placeholder="补发天数" value={form.days} onChange={(e) => setForm((prev) => ({ ...prev, days: e.target.value }))} />
              <Input type="number" placeholder="剩余天数" value={form.remainingDays} onChange={(e) => setForm((prev) => ({ ...prev, remainingDays: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input type="date" value={form.startAt} onChange={(e) => setForm((prev) => ({ ...prev, startAt: e.target.value }))} />
              <Input type="date" value={form.endAt} onChange={(e) => setForm((prev) => ({ ...prev, endAt: e.target.value }))} />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[30, 90, 180, 365].map((days) => (
                <Button key={days} variant="secondary" onClick={() => setForm((prev) => ({ ...prev, days: String(days) }))}>
                  {days}天
                </Button>
              ))}
            </div>
          </div>

          {selectedMembership ? (
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <p>当前角色：{selectedMembership.memberRoleName}</p>
              <p className="mt-1">当前状态：{selectedMembership.isActive ? '有效会员' : '已过期'}</p>
              <p className="mt-1">来源说明：{selectedMembership.sourceRemark || '暂无'}</p>
              <p className="mt-1">最后更新时间：{formatDate(selectedMembership.updatedAt)}</p>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <p>说明：</p>
              <ul className="mt-2 space-y-1 leading-6">
                <li>1. 标准会员开放浏览、搜索、筛选、详情与立即投递。</li>
                <li>2. 超级会员自动继承标准会员，并额外开放内推、求职进度和专属推荐。</li>
                <li>3. 超级会员有效期内补发标准会员，系统会自动保留超级会员等级。</li>
              </ul>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <Button className="flex-1" onClick={() => void handleSubmit()} disabled={saving}>{saving ? '保存中...' : '保存会员'}</Button>
            {selectedMembership ? <Button className="flex-1" variant="secondary" onClick={() => void handleDelete()}>删除记录</Button> : null}
          </div>
        </Card>
      </section>
    </div>
  );
}
