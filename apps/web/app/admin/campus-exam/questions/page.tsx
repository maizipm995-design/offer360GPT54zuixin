'use client';

import { useEffect, useState } from 'react';
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
  CampusExamAdminQuestionListItem,
  CampusExamAdminSpecial,
  CampusExamListResponse,
  CampusExamQuestionDetail,
} from '@/lib/campus-exam';
import { buildQuery } from '@/lib/admin';
import { clientFetch } from '@/lib/api';
import { formatDate } from '@/lib/utils';

const initialFilters = {
  categoryId: '',
  specialId: '',
  questionType: '',
  difficulty: '',
  status: '',
  keyword: '',
  isHighFrequencyWrong: '',
};

const questionTypeOptions = [
  { value: '1', label: '单选题' },
  { value: '2', label: '多选题' },
  { value: '3', label: '判断题' },
  { value: '4', label: '单项填空' },
  { value: '5', label: '多项填空' },
  { value: '6', label: '简答题' },
];

type QuestionForm = {
  stemHtml: string;
  analysisHtml: string;
  difficulty: string;
  questionType: string;
  status: string;
  isHighFrequencyWrong: string;
  optionsJson: string;
  answerJson: string;
  questionImageUrl: string;
  analysisImageUrl: string;
  questionImageOssUrl: string;
  analysisImageOssUrl: string;
};

function createEmptyForm(): QuestionForm {
  return {
    stemHtml: '',
    analysisHtml: '',
    difficulty: '3',
    questionType: '1',
    status: 'active',
    isHighFrequencyWrong: 'false',
    optionsJson: '[]',
    answerJson: '{"type":"single","values":[]}',
    questionImageUrl: '',
    analysisImageUrl: '',
    questionImageOssUrl: '',
    analysisImageOssUrl: '',
  };
}

function buildForm(detail: CampusExamQuestionDetail): QuestionForm {
  return {
    stemHtml: detail.stemHtml ?? '',
    analysisHtml: detail.analysisHtml ?? '',
    difficulty: String(detail.difficulty),
    questionType: String(detail.questionType),
    status: detail.status,
    isHighFrequencyWrong: String(detail.isHighFrequencyWrong),
    optionsJson: JSON.stringify(detail.optionsJson ?? [], null, 2),
    answerJson: JSON.stringify(detail.answerJson ?? { type: detail.questionTypeCode, values: [] }, null, 2),
    questionImageUrl: detail.questionImageUrl ?? '',
    analysisImageUrl: detail.analysisImageUrl ?? '',
    questionImageOssUrl: detail.questionImageOssUrl ?? '',
    analysisImageOssUrl: detail.analysisImageOssUrl ?? '',
  };
}

export default function CampusExamAdminQuestionsPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState<CampusExamListResponse<CampusExamAdminQuestionListItem>>({
    list: [],
    pagination: { page: 1, limit: 10, total: 0, hasMore: false },
  });
  const [categories, setCategories] = useState<CampusExamAdminCategory[]>([]);
  const [specials, setSpecials] = useState<CampusExamAdminSpecial[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<CampusExamQuestionDetail | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<QuestionForm>(createEmptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const page = data.pagination.page || 1;
  const pageSize = data.pagination.limit || 10;

  const loadOptions = async () => {
    try {
      const [categoryResult, specialResult] = await Promise.all([
        clientFetch<CampusExamListResponse<CampusExamAdminCategory>>('/admin/campus-exam/categories?page=1&pageSize=100'),
        clientFetch<CampusExamListResponse<CampusExamAdminSpecial>>('/admin/campus-exam/specials?page=1&pageSize=200'),
      ]);
      setCategories(categoryResult.list);
      setSpecials(specialResult.list);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '题目筛选项加载失败');
    }
  };

  const loadData = async (nextPage = page, nextFilters = filters) => {
    try {
      setLoading(true);
      const query = buildQuery({ ...nextFilters, page: nextPage, pageSize });
      const result = await clientFetch<CampusExamListResponse<CampusExamAdminQuestionListItem>>(`/admin/campus-exam/questions?${query}`);
      setData(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '题目列表加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadQuestionDetail = async (id: string) => {
    try {
      const result = await clientFetch<CampusExamQuestionDetail>(`/admin/campus-exam/questions/${id}`);
      setSelectedId(id);
      setDetail(result);
      setForm(buildForm(result));
      setEditorOpen(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '题目详情加载失败');
    }
  };

  const closeEditorModal = () => {
    setEditorOpen(false);
  };

  useEffect(() => {
    void Promise.all([loadOptions(), loadData(1, filters)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    if (!selectedId) {
      setMessage('请先从左侧选择题目后再编辑');
      return;
    }
    try {
      setSaving(true);
      await clientFetch(`/admin/campus-exam/questions/${selectedId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          stemHtml: form.stemHtml,
          analysisHtml: form.analysisHtml,
          difficulty: Number(form.difficulty),
          questionType: Number(form.questionType),
          status: form.status,
          isHighFrequencyWrong: form.isHighFrequencyWrong === 'true',
          optionsJson: JSON.parse(form.optionsJson || '[]'),
          answerJson: JSON.parse(form.answerJson || '{}'),
          questionImageUrl: form.questionImageUrl || null,
          analysisImageUrl: form.analysisImageUrl || null,
          questionImageOssUrl: form.questionImageOssUrl || null,
          analysisImageOssUrl: form.analysisImageOssUrl || null,
        }),
      });
      setMessage('题目已更新');
      await loadQuestionDetail(selectedId);
      await loadData(page, filters);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '题目保存失败，请检查 JSON 格式');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusToggle = async (status: string) => {
    if (!selectedId) return;
    try {
      await clientFetch(`/admin/campus-exam/questions/${selectedId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setMessage(`题目已切换为 ${status}`);
      await loadQuestionDetail(selectedId);
      await loadData(page, filters);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '题目状态更新失败');
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Campus exam admin</p>
        <div className="mt-2">
          <h2 className="text-3xl font-bold text-ink">校招笔试题目管理</h2>
          <p className="mt-2 text-sm text-muted">按分类、题型、难度筛选题目，查看 OSS 转存状态并直接修正文案、答案、解析。</p>
        </div>
        <div className="mt-4">
          <CampusExamAdminNav />
        </div>
      </section>

      {message ? <Card className="p-4 text-sm text-slate-600">{message}</Card> : null}

      <section className="space-y-4">
        <Card className="rounded-3xl p-4">
          <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
            <Select value={filters.categoryId} onChange={(event) => setFilters((prev) => ({ ...prev, categoryId: event.target.value }))}>
              <option value="">全部一级分类</option>
              {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
            <Select value={filters.specialId} onChange={(event) => setFilters((prev) => ({ ...prev, specialId: event.target.value }))}>
              <option value="">全部二级分类</option>
              {specials
                .filter((item) => !filters.categoryId || item.categoryId === filters.categoryId)
                .map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
            <Select value={filters.questionType} onChange={(event) => setFilters((prev) => ({ ...prev, questionType: event.target.value }))}>
              <option value="">全部题型</option>
              {questionTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </Select>
            <Select value={filters.difficulty} onChange={(event) => setFilters((prev) => ({ ...prev, difficulty: event.target.value }))}>
              <option value="">全部难度</option>
              {[1, 2, 3, 4, 5].map((item) => <option key={item} value={item}>难度 {item}</option>)}
            </Select>
            <Select value={filters.isHighFrequencyWrong} onChange={(event) => setFilters((prev) => ({ ...prev, isHighFrequencyWrong: event.target.value }))}>
              <option value="">全部高频错题状态</option>
              <option value="true">仅高频错题</option>
              <option value="false">仅普通题</option>
            </Select>
            <Select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
              <option value="">全部状态</option>
              <option value="active">启用</option>
              <option value="inactive">停用</option>
            </Select>
            <Input
              placeholder="搜索题干 / 解析"
              value={filters.keyword}
              onChange={(event) => setFilters((prev) => ({ ...prev, keyword: event.target.value }))}
            />
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
          headers={['题型', '专项', '难度', '资源状态', '状态', '更新时间']}
          hasData={data.list.length > 0}
          emptyText={loading ? '题目列表加载中...' : '暂无题目'}
        >
          {data.list.map((item) => (
            <tr
              key={item.id}
              className={`cursor-pointer border-b border-slate-100 last:border-b-0 ${selectedId === item.id ? 'bg-brand/5' : 'hover:bg-slate-50'}`}
              onClick={() => void loadQuestionDetail(item.id)}
            >
              <td className="px-4 py-3 text-slate-600">
                <div className="font-medium text-ink">{item.questionTypeLabel}</div>
                <div className="text-xs text-slate-400">{item.isHighFrequencyWrong ? '高频错题' : '普通题'}</div>
              </td>
              <td className="px-4 py-3 text-slate-600">{item.categoryName} · {item.specialName}</td>
              <td className="px-4 py-3 text-slate-600">难度 {item.difficulty}</td>
              <td className="px-4 py-3 text-slate-600">{item.assetTransferStatus}</td>
              <td className="px-4 py-3 text-slate-600">{item.status}</td>
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
        title="题目详情 / 编辑"
        description="JSON 字段支持直接编辑，保存前请确保格式合法。"
        onClose={closeEditorModal}
      >
        {detail ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="rounded-full bg-slate-100 px-3 py-1">题目 ID: {detail.id}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">资源状态: {(detail as CampusExamAdminQuestionListItem).assetTransferStatus ?? '-'}</span>
              </div>
              <Link href={`/campus-exam/question/${detail.id}`} className="text-sm font-medium text-brand hover:underline">
                前台预览
              </Link>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-ink">题型</span>
                <Select value={form.questionType} onChange={(event) => setForm((prev) => ({ ...prev, questionType: event.target.value }))}>
                  {questionTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </Select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-ink">难度</span>
                <Select value={form.difficulty} onChange={(event) => setForm((prev) => ({ ...prev, difficulty: event.target.value }))}>
                  {[1, 2, 3, 4, 5].map((item) => <option key={item} value={item}>难度 {item}</option>)}
                </Select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-ink">状态</span>
                <Select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}>
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </Select>
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">高频错题</span>
              <Select value={form.isHighFrequencyWrong} onChange={(event) => setForm((prev) => ({ ...prev, isHighFrequencyWrong: event.target.value }))}>
                <option value="false">否</option>
                <option value="true">是</option>
              </Select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">题干 HTML</span>
              <Textarea className="min-h-[140px]" value={form.stemHtml} onChange={(event) => setForm((prev) => ({ ...prev, stemHtml: event.target.value }))} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">解析 HTML</span>
              <Textarea className="min-h-[140px]" value={form.analysisHtml} onChange={(event) => setForm((prev) => ({ ...prev, analysisHtml: event.target.value }))} />
            </label>
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-ink">选项 JSON</span>
                <Textarea className="min-h-[180px] font-mono text-xs" value={form.optionsJson} onChange={(event) => setForm((prev) => ({ ...prev, optionsJson: event.target.value }))} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-ink">答案 JSON</span>
                <Textarea className="min-h-[180px] font-mono text-xs" value={form.answerJson} onChange={(event) => setForm((prev) => ({ ...prev, answerJson: event.target.value }))} />
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-ink">原题图地址</span>
                <Input value={form.questionImageUrl} onChange={(event) => setForm((prev) => ({ ...prev, questionImageUrl: event.target.value }))} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-ink">原解析图地址</span>
                <Input value={form.analysisImageUrl} onChange={(event) => setForm((prev) => ({ ...prev, analysisImageUrl: event.target.value }))} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-ink">题图 OSS 地址</span>
                <Input value={form.questionImageOssUrl} onChange={(event) => setForm((prev) => ({ ...prev, questionImageOssUrl: event.target.value }))} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-ink">解析图 OSS 地址</span>
                <Input value={form.analysisImageOssUrl} onChange={(event) => setForm((prev) => ({ ...prev, analysisImageOssUrl: event.target.value }))} />
              </label>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => void handleStatusToggle(detail.status === 'active' ? 'inactive' : 'active')}>
                {detail.status === 'active' ? '下架题目' : '重新上架'}
              </Button>
              <Button variant="secondary" onClick={closeEditorModal}>关闭</Button>
              <Button onClick={() => void handleSave()} disabled={saving}>{saving ? '保存中...' : '保存题目'}</Button>
            </div>
          </div>
        ) : (
          <p className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">请先从题目列表选择一条记录。</p>
        )}
      </AdminModal>
    </div>
  );
}
