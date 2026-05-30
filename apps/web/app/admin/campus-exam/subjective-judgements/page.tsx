'use client';

import { useEffect, useState } from 'react';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { CampusExamAdminNav } from '@/components/admin/campus-exam-admin-nav';
import { AdminTable } from '@/components/admin/admin-table';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type {
  CampusExamAdminSubjectiveJudgementDetail,
  CampusExamAdminSubjectiveJudgementListItem,
  CampusExamListResponse,
} from '@/lib/campus-exam';
import { buildQuery } from '@/lib/admin';
import { clientFetch } from '@/lib/api';
import { formatDate } from '@/lib/utils';

const initialFilters = {
  userId: '',
  questionId: '',
  scoringMode: '',
  result: '',
  qualityStatus: '',
};

export default function CampusExamAdminSubjectiveJudgementsPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState<CampusExamListResponse<CampusExamAdminSubjectiveJudgementListItem>>({
    list: [],
    pagination: { page: 1, limit: 10, total: 0, hasMore: false },
  });
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<CampusExamAdminSubjectiveJudgementDetail | null>(null);
  const [qualityStatus, setQualityStatus] = useState('pending');
  const [qualityNote, setQualityNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const page = data.pagination.page || 1;
  const pageSize = data.pagination.limit || 10;

  const loadData = async (nextPage = page, nextFilters = filters) => {
    try {
      setLoading(true);
      const query = buildQuery({ ...nextFilters, page: nextPage, pageSize });
      const result = await clientFetch<CampusExamListResponse<CampusExamAdminSubjectiveJudgementListItem>>(
        `/admin/campus-exam/subjective-judgements?${query}`,
      );
      setData(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '主观题判分记录加载失败');
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
      setMessage(error instanceof Error ? error.message : '判分详情加载失败');
    }
  };

  useEffect(() => {
    void loadData(1, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setMessage('质检状态已更新');
      await loadDetail(selectedId);
      await loadData(page, filters);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '质检状态更新失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Campus exam admin</p>
        <div className="mt-2">
          <h2 className="text-3xl font-bold text-ink">主观题判分记录</h2>
          <p className="mt-2 text-sm text-muted">按用户、题目、评分模式和结果筛选，查看关键词命中、AI 理由和人工质检状态。</p>
        </div>
        <div className="mt-4">
          <CampusExamAdminNav />
        </div>
      </section>

      {message ? <Card className="p-4 text-sm text-slate-600">{message}</Card> : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
        <div className="space-y-4">
          <Card className="rounded-3xl p-4">
            <div className="grid gap-3 md:grid-cols-5">
              <Input placeholder="用户 ID" value={filters.userId} onChange={(event) => setFilters((prev) => ({ ...prev, userId: event.target.value }))} />
              <Input placeholder="题目 ID" value={filters.questionId} onChange={(event) => setFilters((prev) => ({ ...prev, questionId: event.target.value }))} />
              <Select value={filters.scoringMode} onChange={(event) => setFilters((prev) => ({ ...prev, scoringMode: event.target.value }))}>
                <option value="">全部评分模式</option>
                <option value="rule">rule</option>
                <option value="hybrid">hybrid</option>
              </Select>
              <Select value={filters.result} onChange={(event) => setFilters((prev) => ({ ...prev, result: event.target.value }))}>
                <option value="">全部结果</option>
                <option value="correct">correct</option>
                <option value="partial">partial</option>
                <option value="wrong">wrong</option>
                <option value="pending_review">pending_review</option>
              </Select>
              <Select value={filters.qualityStatus} onChange={(event) => setFilters((prev) => ({ ...prev, qualityStatus: event.target.value }))}>
                <option value="">全部质检状态</option>
                <option value="pending">pending</option>
                <option value="approved">approved</option>
                <option value="flagged">flagged</option>
              </Select>
            </div>
            <div className="mt-3 flex gap-2">
              <Button onClick={() => void loadData(1, filters)}>搜索</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setFilters(initialFilters);
                  void loadData(1, initialFilters);
                }}
              >
                重置
              </Button>
            </div>
          </Card>

          <AdminTable
            headers={['结果', '得分', '评分模式', '命中点', '质检状态', '时间']}
            hasData={data.list.length > 0}
            emptyText={loading ? '主观题判分记录加载中...' : '暂无记录'}
          >
            {data.list.map((item) => (
              <tr
                key={item.id}
                className={`cursor-pointer border-b border-slate-100 last:border-b-0 ${selectedId === item.id ? 'bg-brand/5' : 'hover:bg-slate-50'}`}
                onClick={() => void loadDetail(item.id)}
              >
                <td className="px-4 py-3 text-slate-600">{item.judgementResult}</td>
                <td className="px-4 py-3 text-slate-600">{item.normalizedScore}</td>
                <td className="px-4 py-3 text-slate-600">{item.scoringMode}</td>
                <td className="px-4 py-3 text-slate-600">{item.matchedKeywords?.slice(0, 3).join('、') || '-'}</td>
                <td className="px-4 py-3 text-slate-600">{item.qualityStatus}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(item.createdAt)}</td>
              </tr>
            ))}
          </AdminTable>

          <AdminPagination
            page={page}
            limit={pageSize}
            total={data.pagination.total || 0}
            onPageChange={(nextPage) => void loadData(nextPage, filters)}
          />
        </div>

        <Card className="rounded-3xl p-5 xl:sticky xl:top-6 xl:self-start">
          <div>
            <h3 className="text-xl font-semibold text-ink">判分详情与质检</h3>
            <p className="mt-1 text-sm text-muted">查看参考答案快照、用户答案快照和 AI 理由，并可人工标注样本质量。</p>
          </div>

          {detail ? (
            <div className="mt-5 space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">结果</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{detail.judgementResult}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">得分 / 模式</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{detail.normalizedScore} / {detail.scoringMode}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-ink">题目题干</p>
                <div className="mt-2 text-sm text-slate-600" dangerouslySetInnerHTML={{ __html: detail.questionStem }} />
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-ink">命中关键词</p>
                <p className="mt-2 text-sm text-slate-600">{detail.matchedKeywords?.join('、') || '暂无'}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-ink">参考答案快照</p>
                <pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs text-slate-600">{detail.referenceAnswerSnapshot}</pre>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-ink">用户答案快照</p>
                <pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs text-slate-600">{detail.userAnswerSnapshot}</pre>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-ink">AI 理由</p>
                <p className="mt-2 text-sm text-slate-600">{detail.aiReasoning || '当前记录无 AI 兜底说明'}</p>
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
                  <span className="text-sm font-medium text-ink">质检备注</span>
                  <Textarea className="min-h-[120px]" value={qualityNote} onChange={(event) => setQualityNote(event.target.value)} />
                </label>
                <Button onClick={() => void handleSaveQuality()} disabled={saving}>
                  {saving ? '保存中...' : '保存质检结果'}
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-5 text-sm text-slate-500">请选择左侧某条主观题判分记录。</p>
          )}
        </Card>
      </section>
    </div>
  );
}
