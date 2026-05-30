'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Circle,
  FileStack,
  PenLine,
  RotateCcw,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { clientFetch } from '@/lib/api';
import type {
  CampusExamAnswerSubmitResult,
  CampusExamCategoryTreeItem,
  CampusExamPracticeMode,
  CampusExamQuestionDetail,
  CampusExamSessionDetail,
  CampusExamSpecialDetail,
} from '@/lib/campus-exam';
import { useAuthStore } from '@/store/auth-store';

type UserAnswerState = {
  type: string;
  values: string[];
};

type CampusExamPracticeClientProps = {
  specialId?: number;
};

const richTextClassName = '[&_img]:my-3 [&_img]:max-h-96 [&_img]:rounded-2xl [&_img]:border [&_img]:border-slate-200 [&_img]:object-contain [&_p]:leading-7 [&_p+_p]:mt-3';

const practiceModeMeta: Record<CampusExamPracticeMode, {
  title: string;
  subtitle: string;
  badge: string;
  startLabel: string;
}> = {
  special_practice: {
    title: '专项顺序练习',
    subtitle: '点击二级分类后的顺序练习模式，按题库固有顺序逐题作答。',
    badge: '二级分类顺序',
    startLabel: '开始顺序练习',
  },
  category_practice: {
    title: '一级分类顺序练习',
    subtitle: '点击一级分类后的顺序练习模式，按该一级分类下全部题目的固有顺序逐题作答。',
    badge: '一级分类顺序',
    startLabel: '开始顺序练习',
  },
  custom_practice: {
    title: '自定义刷题',
    subtitle: '勾选多个二级分类后，从所选范围随机抽取 25 题进行练习。',
    badge: '自选范围随机 25 题',
    startLabel: '开始自定义刷题',
  },
  quick_practice: {
    title: '快速练习',
    subtitle: '每个一级分类随机抽取 5 题，并按分类分组连续展示。',
    badge: '分类随机 5 题',
    startLabel: '开始快速练习',
  },
  smart_mock: {
    title: '智能模考',
    subtitle: '每个一级分类随机抽取 20 题，并按分类分组进入整套模考。',
    badge: '分类随机 20 题',
    startLabel: '开始智能模考',
  },
  wrong_retry: {
    title: '错题重练',
    subtitle: '从错题库随机抽取 10 题，适合做针对性回顾。',
    badge: '错题随机 10 题',
    startLabel: '开始错题重练',
  },
};

function toggleSelection(values: string[], next: string) {
  return values.includes(next) ? values.filter((item) => item !== next) : [...values, next];
}

function resolvePracticeMode(value: string | null, specialId?: number): CampusExamPracticeMode {
  if (specialId) return 'special_practice';
  if (
    value === 'category_practice'
    || value === 'custom_practice'
    || value === 'quick_practice'
    || value === 'smart_mock'
    || value === 'wrong_retry'
  ) {
    return value;
  }
  return 'quick_practice';
}

function buildPracticeAnswerResult(question: CampusExamQuestionDetail) {
  if (!question.answerRecord) return null;
  return {
    questionId: question.id,
    isCorrect: question.answerRecord.isCorrect,
    score: question.answerRecord.score,
    answerStatus: question.answerRecord.answerStatus,
    judgementResult: question.answerRecord.subjectiveJudgement?.judgementResult,
    subjectiveJudgement: question.answerRecord.subjectiveJudgement
      ? {
          scoringMode: question.answerRecord.subjectiveJudgement.scoringMode,
          matchedKeywords: question.answerRecord.subjectiveJudgement.matchedKeywords,
          reason: question.answerRecord.subjectiveJudgement.reason,
        }
      : null,
  } satisfies CampusExamAnswerSubmitResult;
}

function buildQuestionRuleHint(question: CampusExamQuestionDetail) {
  const rule = question.interactionRule;
  if (rule.mode === 'single_choice') {
    return '单选题仅可选择 1 个选项，点击后自动提交并进入下一题。';
  }
  if (rule.mode === 'multiple_choice') {
    return `多选题需选择 ${rule.minSelectionCount}~${rule.maxSelectionCount} 个选项后再手动提交。`;
  }
  if (rule.mode === 'judge') {
    return '判断题点击“正确/错误”后自动提交并进入下一题。';
  }
  if (rule.mode === 'blank_single') {
    return '单项填空题需填写 1 个答案后提交。';
  }
  if (rule.mode === 'blank_multiple') {
    return `多项填空题需填写 ${rule.blankCount} 个答案后提交。`;
  }
  return '简答题需填写答案后手动提交。';
}

function validateQuestionAnswer(question: CampusExamQuestionDetail, answer: UserAnswerState) {
  const nonEmptyValues = answer.values.map((item) => item.trim()).filter(Boolean);
  const rule = question.interactionRule;
  if (rule.mode === 'single_choice') {
    return nonEmptyValues.length === 1 ? '' : '单选题只能选择 1 个选项';
  }
  if (rule.mode === 'multiple_choice') {
    return nonEmptyValues.length >= rule.minSelectionCount && nonEmptyValues.length <= rule.maxSelectionCount
      ? ''
      : `多选题需选择 ${rule.minSelectionCount}~${rule.maxSelectionCount} 个选项`;
  }
  if (rule.mode === 'judge') {
    return nonEmptyValues.length === 1 ? '' : '判断题请选择“正确”或“错误”';
  }
  if (rule.mode === 'blank_single') {
    return nonEmptyValues.length === 1 ? '' : '请填写当前题目的答案';
  }
  if (rule.mode === 'blank_multiple') {
    return nonEmptyValues.length === rule.blankCount ? '' : `请填写完整的 ${rule.blankCount} 个空答案`;
  }
  return nonEmptyValues[0] ? '' : '请填写当前题目的答案';
}

function buildSubmitButtonLabel(question: CampusExamQuestionDetail | null, submitting: boolean) {
  if (submitting) {
    return '提交中...';
  }
  if (!question) {
    return '提交答案';
  }
  return question.interactionRule.autoSubmitOnOptionClick ? '自动提交中' : '提交答案';
}

function renderOptionContent(option: { label: string; value: string; previewHtml?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 font-medium">{option.label}</span>
      <div
        className="min-w-0 flex-1 [&_img]:my-2 [&_img]:max-h-64 [&_img]:rounded-xl [&_img]:border [&_img]:border-slate-200 [&_img]:object-contain"
        dangerouslySetInnerHTML={{ __html: option.previewHtml ?? option.value }}
      />
    </div>
  );
}

function isSpecialAvailable(status?: string) {
  if (!status) return true;
  return ['published', 'enabled', 'active'].includes(status.toLowerCase());
}

export default function CampusExamPracticeClient({ specialId }: CampusExamPracticeClientProps) {
  const searchParams = useSearchParams();
  const token = useAuthStore((state) => state.token);
  const requestedMode = resolvePracticeMode(searchParams.get('mode'), specialId);
  const initialView = searchParams.get('view') === 'summary' ? 'summary' : 'question';
  const requestedCategoryId = searchParams.get('categoryId') ?? '';
  const modeMeta = practiceModeMeta[requestedMode];
  const [special, setSpecial] = useState<CampusExamSpecialDetail | null>(null);
  const [categoryTree, setCategoryTree] = useState<CampusExamCategoryTreeItem[]>([]);
  const [session, setSession] = useState<CampusExamSessionDetail | null>(null);
  const [question, setQuestion] = useState<CampusExamQuestionDetail | null>(null);
  const [answer, setAnswer] = useState<UserAnswerState>({ type: 'single', values: [] });
  const [result, setResult] = useState<CampusExamAnswerSubmitResult | null>(null);
  const [error, setError] = useState('');
  const [answerError, setAnswerError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [jumping, setJumping] = useState(false);
  const [practiceView, setPracticeView] = useState<'question' | 'summary'>(initialView);
  const [selectedSpecialIds, setSelectedSpecialIds] = useState<number[]>([]);
  const [isQuestionCardOpen, setIsQuestionCardOpen] = useState(false);

  const currentIndex = useMemo(() => {
    if (!session?.questionOrder?.length || !question?.id) return 0;
    const index = session.questionOrder.indexOf(question.id);
    return index >= 0 ? index : 0;
  }, [question?.id, session?.questionOrder]);

  const currentGroupLabel = useMemo(() => {
    if (!session?.questionGroups?.length || !question?.id) return '';
    const matched = session.questionGroups.find((group) => group.questionIds.includes(question.id));
    return matched?.label ?? '';
  }, [question?.id, session?.questionGroups]);

  const selectedCategory = useMemo(
    () => categoryTree.find((item) => item.id === requestedCategoryId) ?? null,
    [categoryTree, requestedCategoryId],
  );

  const selectedSpecialCount = selectedSpecialIds.length;

  const settlement = useMemo(() => {
    if (!session) return null;
    const totalQuestions = session.totalQuestions || 0;
    const correctCount = session.correctCount || 0;
    const wrongCount = Math.max(totalQuestions - correctCount, 0);
    const scoreSum = Object.values(session.answeredMap ?? {}).reduce((sum, item) => sum + Number(item.score ?? 0), 0);
    const scoreRate = totalQuestions ? Math.round((scoreSum / totalQuestions) * 100) : 0;
    return {
      scoreRate,
      totalQuestions,
      correctCount,
      wrongCount,
    };
  }, [session]);

  useEffect(() => {
    if (!specialId) {
      setSpecial(null);
      return;
    }
    clientFetch<CampusExamSpecialDetail>(`/campus-exam/specials/${specialId}`, undefined, token ?? undefined)
      .then(setSpecial)
      .catch((err) => setError(err instanceof Error ? err.message : '专项信息加载失败'));
  }, [specialId, token]);

  useEffect(() => {
    if (specialId || (requestedMode !== 'category_practice' && requestedMode !== 'custom_practice')) {
      setCategoryTree([]);
      return;
    }
    clientFetch<CampusExamCategoryTreeItem[]>('/campus-exam/categories/tree')
      .then((result) => {
        setCategoryTree(result);
        if (requestedMode !== 'custom_practice') {
          return;
        }
        const defaultSpecialIds = result
          .flatMap((category) => category.specials.filter((item) => item.questionCount > 0 && isSpecialAvailable(item.status)))
          .slice(0, 3)
          .map((item) => item.id);
        setSelectedSpecialIds((prev) => (prev.length ? prev : defaultSpecialIds));
      })
      .catch((err) => setError(err instanceof Error ? err.message : '刷题范围加载失败'));
  }, [requestedMode, specialId]);

  const syncUrl = useCallback((sessionId: string, view: 'question' | 'summary' = 'question') => {
    const nextParams = new URLSearchParams();
    if (!specialId) {
      nextParams.set('mode', requestedMode);
    }
    nextParams.set('sessionId', sessionId);
    if (view === 'summary') {
      nextParams.set('view', 'summary');
    }
    const nextQuery = nextParams.toString();
    window.history.replaceState(null, '', `${window.location.pathname}?${nextQuery}`);
  }, [requestedMode, specialId]);

  const applyQuestionState = useCallback((detail: CampusExamQuestionDetail) => {
    setQuestion(detail);
    setAnswer(detail.answerRecord?.userAnswer ?? { type: detail.questionTypeCode, values: [] });
    setResult(buildPracticeAnswerResult(detail));
    setAnswerError('');
    setError('');
  }, []);

  const fetchSessionDetail = useCallback(async (sessionId: string) => clientFetch<CampusExamSessionDetail>(
    `/campus-exam/practice/sessions/${sessionId}`,
    undefined,
    token ?? undefined,
  ), [token]);

  const fetchQuestionDetail = useCallback(async (sessionId: string, questionId: string) => clientFetch<CampusExamQuestionDetail>(
    `/campus-exam/questions/${questionId}?sessionId=${sessionId}`,
    undefined,
    token ?? undefined,
  ), [token]);

  const loadInitialSession = useCallback(async (sessionId: string) => {
    if (!token) {
      setError('请先登录后再开始刷题');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const sessionDetail = await fetchSessionDetail(sessionId);
      setSession(sessionDetail);
      setIsQuestionCardOpen(false);
      const nextView = sessionDetail.status === 'completed' ? 'summary' : initialView;
      setPracticeView(nextView);
      syncUrl(sessionId, nextView);
      const questionId = sessionDetail.lastQuestionId || sessionDetail.firstQuestionId || sessionDetail.questionOrder[0];
      if (questionId) {
        const questionDetail = await fetchQuestionDetail(sessionId, questionId);
        applyQuestionState(questionDetail);
      } else {
        setQuestion(null);
        setResult(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '练习会话加载失败');
    } finally {
      setLoading(false);
    }
  }, [applyQuestionState, fetchQuestionDetail, fetchSessionDetail, initialView, syncUrl, token]);

  useEffect(() => {
    const sessionId = searchParams.get('sessionId');
    if (!sessionId || !token) {
      setLoading(false);
      return;
    }
    void loadInitialSession(sessionId);
  }, [loadInitialSession, searchParams, token]);

  const jumpToQuestion = async (questionId: string) => {
    if (!session?.sessionId || !token) return;
    setJumping(true);
    setError('');
    try {
      const detail = await fetchQuestionDetail(session.sessionId, questionId);
      setPracticeView('question');
      setIsQuestionCardOpen(false);
      syncUrl(session.sessionId, 'question');
      applyQuestionState(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : '题目加载失败');
    } finally {
      setJumping(false);
    }
  };

  const handleStart = async () => {
    if (!token) {
      setError('请先登录后再开始练习');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const body: Record<string, unknown> = specialId
        ? { mode: 'special_practice', specialId }
        : requestedMode === 'category_practice'
          ? { mode: 'category_practice', categoryId: requestedCategoryId }
          : requestedMode === 'custom_practice'
            ? { mode: 'custom_practice', specialIds: selectedSpecialIds }
            : { mode: requestedMode };
      const created = await clientFetch<{ sessionId: string }>('/campus-exam/practice/sessions', {
        method: 'POST',
        body: JSON.stringify(body),
      }, token);
      setPracticeView('question');
      setIsQuestionCardOpen(false);
      syncUrl(created.sessionId, 'question');
      await loadInitialSession(created.sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建练习会话失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (nextAnswer?: UserAnswerState) => {
    if (!session?.sessionId || !question || !token || submitting) return;
    const submitAnswer = nextAnswer ?? answer;
    const validationMessage = validateQuestionAnswer(question, submitAnswer);
    if (validationMessage) {
      setAnswerError(validationMessage);
      return;
    }
    setSubmitting(true);
    setError('');
    setAnswerError('');
    try {
      const submitResult = await clientFetch<CampusExamAnswerSubmitResult>(
        `/campus-exam/practice/sessions/${session.sessionId}/answers`,
        {
          method: 'POST',
          body: JSON.stringify({
            questionId: question.id,
            userAnswer: submitAnswer,
            usedTimeSec: 10,
          }),
        },
        token,
      );
      const sessionDetail = await fetchSessionDetail(session.sessionId);
      setSession(sessionDetail);
      setResult(submitResult);
      if (sessionDetail.status === 'completed') {
        setIsQuestionCardOpen(false);
        setPracticeView('summary');
        syncUrl(session.sessionId, 'summary');
        return;
      }
      const shouldAdvance = question.interactionRule.autoSubmitOnOptionClick;
      if (shouldAdvance) {
        const nextQuestionId = sessionDetail.questionOrder[currentIndex + 1];
        if (nextQuestionId) {
          const nextQuestion = await fetchQuestionDetail(session.sessionId, nextQuestionId);
          applyQuestionState(nextQuestion);
        } else {
          const currentQuestion = await fetchQuestionDetail(session.sessionId, question.id);
          applyQuestionState(currentQuestion);
          setResult(submitResult);
        }
      } else {
        const currentQuestion = await fetchQuestionDetail(session.sessionId, question.id);
        applyQuestionState(currentQuestion);
        setResult(submitResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交答案失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSingleChoiceSubmit = (optionKey: string) => {
    if (!question || submitting) return;
    const nextAnswer = { type: question.questionTypeCode, values: [optionKey] };
    setAnswer(nextAnswer);
    setAnswerError('');
    void handleSubmit(nextAnswer);
  };

  const toggleCustomSpecial = (nextSpecialId: number) => {
    setSelectedSpecialIds((prev) => (
      prev.includes(nextSpecialId)
        ? prev.filter((item) => item !== nextSpecialId)
        : [...prev, nextSpecialId]
    ));
  };

  const toggleCustomCategory = (category: CampusExamCategoryTreeItem) => {
    const selectableSpecialIds = category.specials
      .filter((item) => item.questionCount > 0 && isSpecialAvailable(item.status))
      .map((item) => item.id);
    setSelectedSpecialIds((prev) => {
      const allSelected = selectableSpecialIds.every((item) => prev.includes(item));
      if (allSelected) {
        return prev.filter((item) => !selectableSpecialIds.includes(item));
      }
      return Array.from(new Set([...prev, ...selectableSpecialIds]));
    });
  };

  const renderAnswerPanel = () => {
    if (!question) return null;
    const options = question.optionsJson ?? [];
    if (question.questionType === 1 || question.questionType === 3) {
      return (
        <div className="space-y-3">
          {options.map((option) => (
            <button
              key={option.key}
              type="button"
              disabled={submitting}
              onClick={() => handleSingleChoiceSubmit(option.key)}
              className={`w-full rounded-2xl border px-4 py-4 text-left text-sm transition ${
                answer.values[0] === option.key
                  ? 'border-brand bg-brand/5 text-brand'
                  : 'border-slate-200 bg-white text-ink hover:border-brand/50 hover:bg-brand/5'
              }`}
            >
              {renderOptionContent(option)}
            </button>
          ))}
        </div>
      );
    }
    if (question.questionType === 2) {
      return (
        <div className="space-y-3">
          {options.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => {
                const alreadySelected = answer.values.includes(option.key);
                if (!alreadySelected && answer.values.length >= question.interactionRule.maxSelectionCount) {
                  setAnswerError(`多选题最多选择 ${question.interactionRule.maxSelectionCount} 个选项`);
                  return;
                }
                setAnswerError('');
                setAnswer({ type: question.questionTypeCode, values: toggleSelection(answer.values, option.key) });
              }}
              className={`w-full rounded-2xl border px-4 py-4 text-left text-sm transition ${
                answer.values.includes(option.key)
                  ? 'border-brand bg-brand/5 text-brand'
                  : 'border-slate-200 bg-white text-ink hover:border-brand/50 hover:bg-brand/5'
              }`}
            >
              {renderOptionContent(option)}
            </button>
          ))}
          <p className="text-xs text-slate-400">已选择 {answer.values.length} 个选项，{buildQuestionRuleHint(question)}</p>
        </div>
      );
    }
    if (question.questionType === 4 || question.questionType === 5) {
      const blankCount = Math.max(question.answerJson?.values.length ?? 1, 1);
      return (
        <div className="space-y-3">
          {Array.from({ length: blankCount }).map((_, index) => (
            <Input
              key={index}
              placeholder={`请输入第 ${index + 1} 空答案`}
              value={answer.values[index] ?? ''}
              onChange={(event) => {
                const nextValues = [...answer.values];
                nextValues[index] = event.target.value;
                setAnswerError('');
                setAnswer({ type: question.questionTypeCode, values: nextValues });
              }}
            />
          ))}
        </div>
      );
    }
    return (
      <Textarea
        placeholder="请输入你的简答题答案"
        value={answer.values[0] ?? ''}
        onChange={(event) => {
          setAnswerError('');
          setAnswer({ type: question.questionTypeCode, values: [event.target.value] });
        }}
      />
    );
  };

  const renderCustomPracticeSelector = () => (
    <Card className="p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-ink">选择刷题范围</h2>
          <p className="mt-2 text-sm text-slate-500">支持跨一级分类勾选多个二级分类，系统会从你选定的范围内随机抽取 25 道题。</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          已选择 {selectedSpecialCount} 个二级分类
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {categoryTree.map((category) => {
          const selectableSpecials = category.specials.filter((item) => item.questionCount > 0 && isSpecialAvailable(item.status));
          const selectedCount = selectableSpecials.filter((item) => selectedSpecialIds.includes(item.id)).length;
          return (
            <div key={category.id} className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-ink">{category.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    已选 {selectedCount}/{selectableSpecials.length} 个二级分类
                  </p>
                </div>
                <Button type="button" variant="secondary" onClick={() => toggleCustomCategory(category)}>
                  {selectedCount === selectableSpecials.length && selectableSpecials.length > 0 ? '取消全选' : '全选本分类'}
                </Button>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                {selectableSpecials.map((item) => {
                  const selected = selectedSpecialIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleCustomSpecial(item.id)}
                      className={`rounded-full border px-4 py-2 text-sm transition ${
                        selected
                          ? 'border-brand bg-brand text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-brand/40 hover:bg-brand/5'
                      }`}
                    >
                      {item.name} · {item.questionCount} 题
                    </button>
                  );
                })}
                {!selectableSpecials.length ? (
                  <p className="text-sm text-slate-400">当前一级分类下暂无可选二级分类。</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 bg-slate-50 px-4 py-6 lg:px-6">
      <Card className="overflow-hidden border-0 bg-gradient-to-r from-[#6B8AFF] to-[#406AFF] p-0 text-white shadow-card">
        <div className="relative overflow-hidden px-6 py-6 lg:px-8">
          <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                {specialId ? '专项顺序' : modeMeta.badge}
              </div>
              <h1 className="mt-3 text-3xl font-bold">
                {specialId
                  ? special?.name ?? modeMeta.title
                  : requestedMode === 'category_practice'
                    ? `${selectedCategory?.name ?? '一级分类'}顺序练习`
                    : modeMeta.title}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-white/85">
                {specialId
                  ? `${special?.category.name ?? '校招笔试'} · 当前二级分类下全部题目会按固有顺序逐题作答，支持自动切题、上一题返回和题卡回溯。`
                  : requestedMode === 'category_practice'
                    ? `${selectedCategory?.name ?? '当前一级分类'}下全部题目将按固有顺序逐题作答。`
                    : modeMeta.subtitle}
              </p>
            </div>
            {!session ? (
              <Button
                onClick={handleStart}
                disabled={
                  submitting
                  || (requestedMode === 'category_practice' && !requestedCategoryId)
                  || (requestedMode === 'custom_practice' && selectedSpecialCount === 0)
                }
                className="rounded-full bg-white px-5 text-brand hover:bg-white/90"
              >
                {submitting ? '创建中...' : modeMeta.startLabel}
              </Button>
            ) : (
              <div className="rounded-2xl bg-white/12 px-4 py-3 text-sm text-white/90">
                <p>{session.title}</p>
                <p className="mt-1">已完成 {session.answeredCount}/{session.totalQuestions}</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {error ? <Card className="border-rose-100 bg-rose-50 p-6 text-sm text-rose-500">{error}</Card> : null}
      {answerError ? <Card className="border-amber-100 bg-amber-50 p-6 text-sm text-amber-700">{answerError}</Card> : null}
      {loading ? <Card className="p-6 text-sm text-slate-500">正在加载刷题会话...</Card> : null}

      {!loading && !session ? (
        requestedMode === 'custom_practice' ? renderCustomPracticeSelector() : (
          <Card className="p-6 lg:p-8">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-5">
                <PenLine className="h-6 w-6 text-brand" />
                <p className="mt-3 text-sm font-semibold text-ink">单题展示</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">每次只加载当前题目，避免整套题一次性堆叠。</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-5">
                <BookOpenCheck className="h-6 w-6 text-brand" />
                <p className="mt-3 text-sm font-semibold text-ink">自动切题</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">客观题作答后自动进入下一题，主观题提交后继续。</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-5">
                <FileStack className="h-6 w-6 text-brand" />
                <p className="mt-3 text-sm font-semibold text-ink">题卡回溯</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">支持按分类查看题卡进度，并自由跳转任意题号。</p>
              </div>
            </div>
          </Card>
        )
      ) : null}

      {session ? (
        <div className="space-y-6">
          {practiceView === 'summary' && settlement ? (
            <Card className="p-6 lg:p-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-brand">答题结算页</p>
                  <h2 className="mt-2 text-3xl font-bold text-ink">本次作答已完成</h2>
                  <p className="mt-2 text-sm text-slate-500">系统已根据本次完整作答情况生成汇总结果。</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-600">
                  得分率 {settlement.scoreRate}%
                </span>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-4">
                <div className="rounded-3xl bg-slate-50 p-5">
                  <p className="text-sm text-slate-500">得分率</p>
                  <p className="mt-3 text-3xl font-bold text-ink">{settlement.scoreRate}%</p>
                </div>
                <div className="rounded-3xl bg-slate-50 p-5">
                  <p className="text-sm text-slate-500">本次测试总题目数量</p>
                  <p className="mt-3 text-3xl font-bold text-ink">{settlement.totalQuestions}</p>
                </div>
                <div className="rounded-3xl bg-emerald-50 p-5">
                  <p className="text-sm text-emerald-600">答对题目数量</p>
                  <p className="mt-3 text-3xl font-bold text-emerald-700">{settlement.correctCount}</p>
                </div>
                <div className="rounded-3xl bg-rose-50 p-5">
                  <p className="text-sm text-rose-500">答错题目数量</p>
                  <p className="mt-3 text-3xl font-bold text-rose-600">{settlement.wrongCount}</p>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button
                  onClick={() => {
                    setPracticeView('question');
                    setIsQuestionCardOpen(false);
                    syncUrl(session.sessionId, 'question');
                  }}
                >
                  回到题卡复盘
                </Button>
                <Link href="/campus-exam/history">
                  <Button variant="secondary">查看练习历史</Button>
                </Link>
                <Link href="/campus-exam">
                  <Button variant="secondary">返回刷题首页</Button>
                </Link>
              </div>
            </Card>
          ) : null}

          {practiceView === 'question' ? (
            <Card className="border-dashed p-4 text-sm text-slate-600">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">{session.title}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    单次仅展示当前题目，点击左下角圆形按钮可唤起底部题卡抽屉并快速切题。
                  </p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
                  进度 {session.answeredCount}/{session.totalQuestions}
                </div>
              </div>
            </Card>
          ) : null}

          {practiceView === 'question' && question ? (
            <Card className="p-0">
              <div className="border-b border-slate-200 px-6 py-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="rounded-full bg-brand/10 px-3 py-1 text-brand">{question.questionTypeLabel}</span>
                      <span>第 {currentIndex + 1} / {session.totalQuestions} 题</span>
                      {currentGroupLabel ? <span>{currentGroupLabel}</span> : null}
                      {question.special?.name ? <span>{question.special.name}</span> : null}
                    </div>
                    <h2 className="mt-3 text-lg font-semibold text-ink">当前题目</h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span>难度 {question.difficulty}</span>
                    {question.isHighFrequencyWrong ? (
                      <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-500">高频错题</span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="px-6 py-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className={richTextClassName} dangerouslySetInnerHTML={{ __html: question.stemPreviewHtml }} />
                  {question.questionImagePreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={question.questionImagePreviewUrl} alt="题目配图" className="mt-4 max-h-96 rounded-2xl border border-slate-200 object-contain" />
                  ) : null}
                </div>

                <div className="mt-6">{renderAnswerPanel()}</div>
                <p className="mt-3 text-xs text-slate-400">{buildQuestionRuleHint(question)}</p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (currentIndex > 0) void jumpToQuestion(session.questionOrder[currentIndex - 1]);
                    }}
                    disabled={currentIndex <= 0 || jumping}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    上一题
                  </Button>
                  <Button
                    onClick={() => void handleSubmit()}
                    disabled={submitting || question.interactionRule.autoSubmitOnOptionClick || Boolean(validateQuestionAnswer(question, answer))}
                  >
                    {buildSubmitButtonLabel(question, submitting)}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (currentIndex < session.questionOrder.length - 1) {
                        void jumpToQuestion(session.questionOrder[currentIndex + 1]);
                      }
                    }}
                    disabled={currentIndex >= session.questionOrder.length - 1 || jumping}
                  >
                    下一题
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>

                {(question.questionType === 1 || question.questionType === 3) ? (
                  <p className="mt-3 text-xs text-slate-400">该题型会在你选择选项后自动提交并切到下一题。</p>
                ) : (
                  <p className="mt-3 text-xs text-slate-400">提交后会先展示判题结果与解析，你可以自行决定是否继续下一题。</p>
                )}
              </div>
            </Card>
          ) : null}

          {practiceView === 'question' && result ? (
            <Card className="p-6">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-lg font-semibold text-ink">当前题目结果</h3>
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm ${
                  result.isCorrect ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'
                }`}>
                  {result.isCorrect ? <CheckCircle2 className="mr-1 h-4 w-4" /> : <Circle className="mr-1 h-4 w-4" />}
                  {result.isCorrect ? '回答正确' : result.judgementResult === 'partial' ? '部分命中' : '回答错误'}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
                  得分 {result.score ?? 0}
                </span>
              </div>
              {result.subjectiveJudgement ? (
                <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  <p>评分模式：{result.subjectiveJudgement.scoringMode}</p>
                  {result.subjectiveJudgement.matchedKeywords?.length ? (
                    <p className="mt-2">命中点：{result.subjectiveJudgement.matchedKeywords.join('、')}</p>
                  ) : null}
                  {result.subjectiveJudgement.reason ? <p className="mt-2">说明：{result.subjectiveJudgement.reason}</p> : null}
                </div>
              ) : null}
              {question?.analysisPreviewHtml ? (
                <div className="mt-4 rounded-2xl border border-slate-200 p-4">
                  <h4 className="text-base font-semibold text-ink">答案解析</h4>
                  <div className={`mt-3 ${richTextClassName}`} dangerouslySetInnerHTML={{ __html: question.analysisPreviewHtml }} />
                  {question.analysisImagePreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={question.analysisImagePreviewUrl} alt="解析配图" className="mt-4 max-h-96 rounded-2xl border border-slate-200 object-contain" />
                  ) : null}
                </div>
              ) : null}
            </Card>
          ) : null}

          {practiceView === 'question' && requestedMode === 'wrong_retry' ? (
            <Card className="border-dashed p-4 text-sm text-slate-500">
              <div className="flex items-start gap-3">
                <RotateCcw className="mt-0.5 h-4 w-4 text-brand" />
                <p>错题重练按错题库随机抽取 10 题，题卡顺序也会按本次随机结果展示。</p>
              </div>
            </Card>
          ) : null}

          {practiceView === 'question' ? (
            <>
              <button
                type="button"
                aria-label="打开题号面板"
                onClick={() => setIsQuestionCardOpen(true)}
                className="fixed bottom-6 left-4 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-[0_16px_40px_rgba(64,106,255,0.35)] transition hover:bg-brand-dark"
              >
                <FileStack className="h-6 w-6" />
              </button>

              {isQuestionCardOpen ? (
                <div className="fixed inset-0 z-40 bg-slate-900/25" onClick={() => setIsQuestionCardOpen(false)} aria-hidden="true" />
              ) : null}

              <div className={`fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 ${isQuestionCardOpen ? 'translate-y-0' : 'translate-y-full'}`}>
                <div className="mx-auto w-full max-w-7xl rounded-t-[32px] border border-slate-200 bg-white shadow-2xl">
                  <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 lg:px-6">
                    <div>
                      <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200" />
                      <h2 className="text-lg font-semibold text-ink">题号面板</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        点击任意题号即可切换题目，切换完成后面板会自动收起。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsQuestionCardOpen(false)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="max-h-[70vh] overflow-y-auto px-5 py-5 lg:px-6">
                    <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                      <p className="font-medium text-ink">当前模式</p>
                      <p className="mt-2">{session.title}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span>已完成 {session.answeredCount}/{session.totalQuestions}</span>
                        {session.status === 'completed' ? <span>本次作答已完成，可查看结算。</span> : <span>可随时切换到任意题目继续作答。</span>}
                      </div>
                    </div>

                    <div className="mt-5 space-y-4">
                      {session.questionGroups.map((group) => (
                        <div key={group.label}>
                          <p className="text-xs font-medium tracking-[0.16em] text-slate-400">{group.label}</p>
                          <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-7 md:grid-cols-9 lg:grid-cols-12">
                            {group.questionIds.map((questionId) => {
                              const index = session.questionOrder.indexOf(questionId);
                              const answered = Boolean(session.answeredMap[questionId]);
                              const active = questionId === question?.id;
                              return (
                                <button
                                  key={questionId}
                                  type="button"
                                  disabled={jumping}
                                  onClick={() => void jumpToQuestion(questionId)}
                                  className={`rounded-2xl px-3 py-3 text-sm transition ${
                                    active
                                      ? 'bg-brand text-white'
                                      : answered
                                        ? 'bg-brand/10 text-brand hover:bg-brand/15'
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                  }`}
                                >
                                  {index + 1}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 flex flex-wrap gap-3 pb-2">
                      {session.status === 'completed' ? (
                        <Button
                          onClick={() => {
                            setIsQuestionCardOpen(false);
                            setPracticeView('summary');
                            syncUrl(session.sessionId, 'summary');
                          }}
                        >
                          查看本次结算
                        </Button>
                      ) : null}
                      <Link href="/campus-exam/history">
                        <Button variant="secondary" onClick={() => setIsQuestionCardOpen(false)}>查看练习历史</Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
