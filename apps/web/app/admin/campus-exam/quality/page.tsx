'use client';

import { useEffect, useMemo, useState } from 'react';
import { CampusExamAdminNav } from '@/components/admin/campus-exam-admin-nav';
import { AdminTable } from '@/components/admin/admin-table';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type {
  CampusExamAdminSubjectiveJudgementDetail,
  CampusExamAdminSubjectiveJudgementListItem,
  CampusExamListResponse,
} from '@/lib/campus-exam';
import { clientFetch } from '@/lib/api';
import { formatDate } from '@/lib/utils';

export default function CampusExamAdminQualityPage() {
  const [list, setList] = useState<CampusExamAdminSubjectiveJudgementListItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<CampusExamAdminSubjectiveJudgementDetail | null>(null);
  const [qualityStatus, setQualityStatus] = useState('pending');
  const [qualityNote, setQualityNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [focusMode, setFocusMode] = useState<'pending' | 'low-score' | 'all'>('pending');

  const loadList = async () => {
    try {
      setLoading(true);
      const result = await clientFetch<CampusExamListResponse<CampusExamAdminSubjectiveJudgementListItem>>(
        '/admin/campus-exam/subjective-judgements?page=1&pageSize=100&qualityStatus=pending',
      );
      setList(result.list);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '质检样本加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: string) => {
    try {
      const result = await clientFetch<CampusExamAdminSubjectiveJudgementDetail>(`/admin/campus-exam/subjective-judgements/${id}`);
      setSelectedId(id);
      setDetail(result);
      setQualityStatus(result.qualityStatus);
      setQualityNote(result.qualityNote ?? '');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '质检详情加载失败');
    }
  };

  useEffect(() => {
    void loadList();
  }, []);

  const visibleList = useMemo(() => {
    if (focusMode === 'pending') {
      return list.filter((item) => item.qualityStatus === 'pending');
    }
    if (focusMode === 'low-score') {
      return list.filter((item) => item.normalizedScore <= 0.6 || item.judgementResult === 'partial');
    }
    return list;
  }, [focusMode, list]);

  const handleSaveQuality = async () => {
    if (!selectedId) return;
    try {
      setSaving(true);
      await clientFetch(`/admin/campus-exam/subjective-judgements/${selectedId}/quality`, {
        method: 'PATCH',
        body: JSON.stringify({
          qualityStatus,
          qualityNote,
        }),
      });
      setMessage('质检样本已更新');
      await Promise.all([loadList(), loadDetail(selectedId)]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '质检状态保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Campus exam admin</p>
        <div className="mt-2">
          <h2 className="text-3xl font-bold text-ink">主观题判分质检页</h2>
          <p className="mt-2 text-sm text-muted">聚焦 `pending` 和低分异常样本，支持人工标注并沉淀规则优化备注。</p>
        </div>
        <div className="mt-4">
          <CampusExamAdminNav />
        </div>
      </section>

      {message ? <Card className="p-4 text-sm text-slate-600">{message}</Card> : null}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
        <div className="space-y-4">
          <Card className="rounded-3xl p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Select value={focusMode} onChange={(event) => setFocusMode(event.target.value as 'pending' | 'low-score' | 'all')}>
                <option value="pending">仅看 pending_review 样本</option>
                <option value="low-score">仅看低分 / partial 样本</option>
                <option value="all">查看全部质检样本</option>
              </Select>
              <Button variant="secondary" onClick={() => void loadList()}>刷新样本</Button>
            </div>
          </Card>

          <AdminTable
            headers={['结果', '得分', '评分模式', '质检状态', '时间']}
            hasData={visibleList.length > 0}
            emptyText={loading ? '质检样本加载中...' : '暂无符合条件的质检样本'}
          >
            {visibleList.map((item) => (
              <tr
                key={item.id}
                className={`cursor-pointer border-b border-slate-100 last:border-b-0 ${selectedId === item.id ? 'bg-brand/5' : 'hover:bg-slate-50'}`}
                onClick={() => void loadDetail(item.id)}
              >
                <td className="px-4 py-3 text-slate-600">{item.judgementResult}</td>
                <td className="px-4 py-3 text-slate-600">{item.normalizedScore}</td>
                <td className="px-4 py-3 text-slate-600">{item.scoringMode}</td>
                <td className="px-4 py-3 text-slate-600">{item.qualityStatus}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(item.createdAt)}</td>
              </tr>
            ))}
          </AdminTable>
        </div>

        <Card className="rounded-3xl p-5 xl:sticky xl:top-6 xl:self-start">
          <h3 className="text-xl font-semibold text-ink">样本质检</h3>
          {detail ? (
            <div className="mt-5 space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">结果</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{detail.judgementResult}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">得分</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{detail.normalizedScore}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-ink">题目题干</p>
                <div className="mt-2 text-sm text-slate-600" dangerouslySetInnerHTML={{ __html: detail.questionStem }} />
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-ink">参考答案快照</p>
                <pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs text-slate-600">{detail.referenceAnswerSnapshot}</pre>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-ink">用户答案快照</p>
                <pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs text-slate-600">{detail.userAnswerSnapshot}</pre>
              </div>

              <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-ink">质检状态</span>
                  <Select value={qualityStatus} onChange={(event) => setQualityStatus(event.target.value)}>
                    <option value="pending">pending</option>
                    <option value="approved">approved</option>
                    <option value="flagged">flagged</option>
                  </Select>
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-ink">规则优化备注</span>
                  <Textarea className="min-h-[140px]" value={qualityNote} onChange={(event) => setQualityNote(event.target.value)} />
                </label>
                <Button onClick={() => void handleSaveQuality()} disabled={saving}>
                  {saving ? '保存中...' : '保存质检备注'}
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-5 text-sm text-slate-500">请选择左侧样本查看详情。</p>
          )}
        </Card>
      </section>
    </div>
  );
}
