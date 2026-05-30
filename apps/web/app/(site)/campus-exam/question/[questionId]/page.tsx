'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { clientFetch } from '@/lib/api';
import type { CampusExamQuestionDetail } from '@/lib/campus-exam';
import { useAuthStore } from '@/store/auth-store';

const richTextClassName = '[&_img]:my-3 [&_img]:max-h-96 [&_img]:rounded-2xl [&_img]:border [&_img]:border-slate-200 [&_img]:object-contain [&_p]:leading-7 [&_p+_p]:mt-3';

function buildQuestionRuleHint(question: CampusExamQuestionDetail) {
  const rule = question.interactionRule;
  if (rule.mode === 'single_choice') {
    return '单选题仅可选择 1 个选项，选择后会自动切题。';
  }
  if (rule.mode === 'multiple_choice') {
    return `多选题需选择 ${rule.minSelectionCount}~${rule.maxSelectionCount} 个选项后提交。`;
  }
  if (rule.mode === 'judge') {
    return '判断题点击正确/错误后自动提交。';
  }
  if (rule.mode === 'blank_single') {
    return '单项填空题需填写 1 个答案后提交。';
  }
  if (rule.mode === 'blank_multiple') {
    return `多项填空题需填写 ${rule.blankCount} 个答案后提交。`;
  }
  return '简答题需填写文本答案后提交。';
}

export default function CampusExamQuestionPage() {
  const params = useParams<{ questionId: string }>();
  const searchParams = useSearchParams();
  const token = useAuthStore((state) => state.token);
  const [data, setData] = useState<CampusExamQuestionDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const questionId = params?.questionId;
    if (!questionId) return;
    const sessionId = searchParams.get('sessionId');
    const query = sessionId ? `?sessionId=${sessionId}` : '';
    clientFetch<CampusExamQuestionDetail>(`/campus-exam/questions/${questionId}${query}`, undefined, token ?? undefined)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : '题目详情加载失败'))
      .finally(() => setLoading(false));
  }, [params, searchParams, token]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 lg:px-6">
      <Card className="p-6 lg:p-8">
        <p className="text-sm font-medium text-brand">Question preview</p>
        <h1 className="mt-3 text-3xl font-bold text-ink">{data?.questionTypeLabel ?? '单题详情'}</h1>
        <p className="mt-2 text-sm text-slate-500">
          {data?.special?.category?.name} · {data?.special?.name}
        </p>
        {data?.special?.id ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={`/campus-exam/special/${data.special.id}`}
              className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700"
            >
              返回专项页
            </Link>
            <Link
              href={`/campus-exam/special/${data.special.id}/practice`}
              className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white"
            >
              开始该专项练习
            </Link>
          </div>
        ) : null}
      </Card>

      {loading ? <Card className="p-6 text-sm text-slate-500">题目详情加载中...</Card> : null}
      {error ? <Card className="p-6 text-sm text-rose-500">{error}</Card> : null}

      {data ? (
        <>
          <Card className="p-6">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span>{data.questionTypeLabel}</span>
              <span>难度 {data.difficulty}</span>
              {data.isHighFrequencyWrong ? <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-500">高频错题</span> : null}
            </div>
            <p className="mt-3 text-sm text-slate-500">{buildQuestionRuleHint(data)}</p>
            <div className="mt-5 rounded-2xl border border-slate-200 p-4">
              <div className={richTextClassName} dangerouslySetInnerHTML={{ __html: data.stemPreviewHtml }} />
              {data.questionImagePreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.questionImagePreviewUrl} alt="题目配图" className="mt-4 max-h-96 rounded-2xl border border-slate-200 object-contain" />
              ) : null}
            </div>
          </Card>

          {data.optionsJson?.length ? (
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-ink">题目选项</h2>
              <div className="mt-4 space-y-3">
                {data.optionsJson.map((option) => (
                  <div key={option.key} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 shrink-0 font-medium text-ink">{option.label}</span>
                      <div
                        className="min-w-0 flex-1 text-sm text-slate-700 [&_img]:my-2 [&_img]:max-h-64 [&_img]:rounded-xl [&_img]:border [&_img]:border-slate-200 [&_img]:object-contain"
                        dangerouslySetInnerHTML={{ __html: option.previewHtml ?? option.value }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          <Card className="p-6">
            <h2 className="text-xl font-semibold text-ink">标准答案</h2>
            <pre className="mt-4 overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              {JSON.stringify(data.answerJson ?? {}, null, 2)}
            </pre>
          </Card>

          {data.answerRecord ? (
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-ink">历史作答结果</h2>
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <span className={`rounded-full px-3 py-1 ${data.answerRecord.isCorrect ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                  {data.answerRecord.isCorrect ? '回答正确' : data.answerRecord.subjectiveJudgement?.judgementResult === 'partial' ? '部分命中' : '回答错误'}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">得分 {data.answerRecord.score ?? 0}</span>
              </div>
              <pre className="mt-4 overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                {JSON.stringify(data.answerRecord.userAnswer, null, 2)}
              </pre>
              {data.answerRecord.subjectiveJudgement ? (
                <div className="mt-4 rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
                  <p>评分模式：{data.answerRecord.subjectiveJudgement.scoringMode}</p>
                  <p className="mt-2">命中点：{data.answerRecord.subjectiveJudgement.matchedKeywords?.join('、') || '暂无'}</p>
                  <p className="mt-2">说明：{data.answerRecord.subjectiveJudgement.reason || '暂无'}</p>
                </div>
              ) : null}
            </Card>
          ) : null}

          <Card className="p-6">
            <h2 className="text-xl font-semibold text-ink">答案解析</h2>
            <div className="mt-4 rounded-2xl border border-slate-200 p-4">
              <div className={richTextClassName} dangerouslySetInnerHTML={{ __html: data.analysisPreviewHtml }} />
              {data.analysisImagePreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.analysisImagePreviewUrl} alt="解析配图" className="mt-4 max-h-96 rounded-2xl border border-slate-200 object-contain" />
              ) : null}
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
