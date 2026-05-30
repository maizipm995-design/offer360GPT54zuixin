'use client';

import {
  BookOpenCheck,
  ChevronDown,
  ChevronRight,
  FileStack,
  PenLine,
  ScrollText,
  Star,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { clientFetch } from '@/lib/api';
import { getPracticeEntryHref, getPracticeSessionHref, type CampusExamHomePayload } from '@/lib/campus-exam';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';

type HeroCardCode = 'quick_practice' | 'smart_mock' | 'wrong_retry';

const heroCardOrder: HeroCardCode[] = ['quick_practice', 'smart_mock', 'wrong_retry'];

const heroCardConfig = {
  quick_practice: {
    icon: PenLine,
    gradient: 'from-[#6B8AFF] to-[#406AFF]',
    description: '每个一级分类随机抽取 5 题，并按分类顺序连续练习',
    title: '快速练习',
    actionLabel: '开始练习',
  },
  smart_mock: {
    icon: ScrollText,
    gradient: 'from-[#4CD294] to-[#22C55E]',
    description: '每个一级分类随机抽取 20 题，按分类分组完成模考',
    title: '智能模考',
    actionLabel: '进入模考',
  },
  wrong_retry: {
    icon: FileStack,
    gradient: 'from-[#FFC145] to-[#FF9F1C]',
    description: '从错题库随机抽取 10 题，适合集中复盘薄弱项',
    title: '错题重练',
    actionLabel: '开始重练',
  },
} as const;

const defaultStats = {
  predictedScore: 0,
  wrongCount: 0,
  noteCount: 0,
  favoriteCount: 0,
};

function getHistoryTag(title: string) {
  return title.includes('试卷')
    ? {
        label: '试卷',
        className: 'bg-orange-50 text-orange-600',
      }
    : {
        label: '练习',
        className: 'bg-blue-50 text-blue-600',
      };
}

function isSpecialAvailable(status?: string) {
  if (!status) return true;
  return ['published', 'enabled', 'active'].includes(status.toLowerCase());
}

export default function CampusExamHomePage() {
  const token = useAuthStore((state) => state.token);
  const [data, setData] = useState<CampusExamHomePayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string>('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    clientFetch<CampusExamHomePayload>('/campus-exam/home', undefined, token ?? undefined)
      .then((result) => {
        if (!active) return;
        setData(result);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : '校招笔试首页加载失败');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!expandedCategoryId && data?.categoryTree?.length) {
      setExpandedCategoryId(data.categoryTree[0].id);
    }
  }, [data, expandedCategoryId]);

  const categoryWithTotals = useMemo(
    () =>
      (data?.categoryTree ?? []).map((category) => ({
        ...category,
        totalQuestions: category.specials.reduce((sum, special) => sum + special.questionCount, 0),
      })),
    [data?.categoryTree],
  );

  const heroCards = useMemo(() => {
    const heroCardMap = new Map((data?.heroCards ?? []).map((card) => [card.code, card]));
    return heroCardOrder.map((code) => {
      const fallback = heroCardConfig[code];
      const remoteCard = heroCardMap.get(code);
      return {
        code,
        title: remoteCard?.title ?? fallback.title,
        enabled: remoteCard?.enabled ?? code === 'quick_practice',
      };
    });
  }, [data?.heroCards]);

  const stats = data?.stats ?? defaultStats;
  const hasCategoryData = categoryWithTotals.length > 0;
  const hasHistoryData = Boolean(data?.history?.length);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 bg-slate-50 px-4 py-6 lg:flex-row lg:px-6">
      <div className="min-w-0 flex-1 space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {heroCards.map((card) => {
            const config = heroCardConfig[card.code];
            const Icon = config?.icon ?? PenLine;
            const href = card.enabled ? getPracticeEntryHref(card.code) : null;
            const buttonEnabled = Boolean(card.enabled && href);
            return (
              <Card
                key={card.code}
                className={`relative overflow-hidden border-0 bg-gradient-to-br ${config?.gradient ?? 'from-brand to-brand-dark'} p-5 text-white shadow-card`}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.22),_transparent_42%)]" />
                <div className="relative z-10 flex min-h-[176px] flex-col">
                  <p className="text-lg font-semibold">{card.title}</p>
                  <p className="mt-2 max-w-[220px] text-sm leading-6 text-white/85">{config?.description}</p>
                  <div className="mt-auto flex items-end justify-between gap-3 pt-6">
                    <div className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                      {card.enabled ? '当前可用' : '敬请期待'}
                    </div>
                    {buttonEnabled && href ? (
                      <Link
                        href={href}
                        className="inline-flex items-center rounded-full bg-white/18 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/28"
                      >
                        {config.actionLabel}
                        <ChevronRight className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="inline-flex cursor-not-allowed items-center rounded-full bg-white/12 px-3 py-1.5 text-xs font-medium text-white/70"
                      >
                        {card.enabled ? '暂未开放' : '敬请期待'}
                      </button>
                    )}
                  </div>
                </div>
                <Icon className="absolute bottom-4 right-4 h-16 w-16 text-white/25" />
                <Icon className="absolute bottom-8 right-10 h-7 w-7 text-white/45" />
              </Card>
            );
          })}
        </div>

        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
            <div className="inline-flex items-center rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white">
              专项顺序练习
            </div>
            {hasCategoryData ? (
              <Link
                href="/campus-exam/practice?mode=custom_practice"
                className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-200"
              >
                <BookOpenCheck className="h-4 w-4" />
                自定义刷题
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex cursor-not-allowed items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-400"
              >
                <BookOpenCheck className="h-4 w-4" />
                自定义刷题
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100">
            {!loading && !hasCategoryData ? (
              <div className="px-6 py-12 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <FileStack className="h-7 w-7" />
                </div>
                <p className="mt-4 text-base font-medium text-slate-700">当前还没有可练习的专项题库</p>
                <p className="mt-2 text-sm text-slate-500">待后台配置专题后，这里会按参考稿结构展示分类与题量。</p>
              </div>
            ) : null}

            {categoryWithTotals.map((category) => {
              const expanded = expandedCategoryId === category.id;
              return (
                <div key={category.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedCategoryId(expanded ? '' : category.id)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {expanded ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-brand" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-brand" />
                        )}
                        <span className="truncate font-medium text-ink">{category.name}</span>
                      </div>
                      {category.description ? (
                        <p className="mt-1 pl-6 text-xs text-slate-400">{category.description}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">共 {category.totalQuestions} 题</span>
                  </button>

                  {expanded ? (
                    <div className="bg-slate-50/70 px-4 pb-4 pl-10">
                      <div className="flex items-center justify-between rounded-xl px-3 py-3 transition hover:bg-white">
                        <span className="text-sm text-ink">全部</span>
                        <div className="ml-4 flex items-center gap-4">
                          <span className="text-xs text-slate-400">共 {category.totalQuestions} 题</span>
                          <Link
                            href={`/campus-exam/practice?mode=category_practice&categoryId=${category.id}`}
                            className="inline-flex items-center text-sm font-medium text-brand transition hover:text-brand-dark"
                          >
                            去练习
                            <ChevronRight className="ml-1 h-4 w-4" />
                          </Link>
                        </div>
                      </div>

                      {category.specials.length ? (
                        category.specials.map((special) => {
                          const specialEnabled = special.questionCount > 0 && isSpecialAvailable(special.status);
                          return (
                            <div
                              key={special.id}
                              className="flex items-center justify-between rounded-xl px-3 py-3 transition hover:bg-white"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-ink">{special.name}</p>
                                <p className="mt-1 truncate text-xs text-slate-400">
                                  {special.description || '按专题刷题，支持记录作答进度。'}
                                </p>
                              </div>
                              <div className="ml-4 flex shrink-0 items-center gap-4">
                                <span className="text-xs text-slate-400">共 {special.questionCount} 题</span>
                                {specialEnabled ? (
                                  <Link
                                    href={`/campus-exam/special/${special.id}`}
                                    className="inline-flex items-center text-sm font-medium text-brand transition hover:text-brand-dark"
                                  >
                                    去练习
                                    <ChevronRight className="ml-1 h-4 w-4" />
                                  </Link>
                                ) : (
                                  <button
                                    type="button"
                                    disabled
                                    className="inline-flex cursor-not-allowed items-center rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-500"
                                  >
                                    暂不可练
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-xl bg-white px-4 py-4 text-sm text-slate-500">
                          当前分类下暂未配置子专项，后续会在这里展示可练习条目。
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Card>

        {loading ? (
          <Card className="p-6 text-sm text-slate-500">正在加载校招笔试首页...</Card>
        ) : null}
        {error ? (
          <Card className="border-rose-100 bg-rose-50 p-6 text-sm text-rose-500">{error}</Card>
        ) : null}
      </div>

      <div className="w-full space-y-6 lg:w-80">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">练习历史</h2>
            <Link href="/campus-exam/history" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700">
              全部
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </div>

          <div className="mt-4 space-y-4">
            {hasHistoryData
              ? (data?.history ?? []).slice(0, 4).map((item, index, list) => {
              const tag = getHistoryTag(item.title);
              const canResume = true;
              return (
                <div
                  key={item.sessionId}
                  className={`${index < list.length - 1 ? 'border-b border-dashed border-slate-200 pb-4' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{item.title}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span className={`rounded px-2 py-0.5 ${tag.className}`}>{tag.label}</span>
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          进度 {item.answeredCount}/{item.totalQuestions}
                        </span>
                        <span>{formatDate(item.updatedAt)}</span>
                      </div>
                    </div>
                    {canResume ? (
                      <Link
                        href={getPracticeSessionHref(item)}
                        className="shrink-0 rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-500 transition hover:bg-rose-100"
                      >
                        {item.status === 'completed' ? '查看结算' : '继续做题'}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="shrink-0 cursor-not-allowed rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-500"
                      >
                        暂不可继续
                      </button>
                    )}
                  </div>
                </div>
              );
            })
              : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
                    <ScrollText className="h-6 w-6" />
                  </div>
                  <p className="mt-4 text-sm font-medium text-slate-600">还没有练习历史</p>
                  <p className="mt-2 text-xs leading-6 text-slate-500">
                    登录后开始做题，这里会展示最近练习记录，并支持继续作答。
                  </p>
                </div>
              )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 py-2">
              <div className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-500 text-white">
                  <TrendingUp className="h-3.5 w-3.5" />
                </div>
                <span>预测分</span>
              </div>
              <span className="font-medium text-slate-700">{stats.predictedScore}/100</span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-200 py-2">
              <div className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-orange-500 text-white">
                  <TriangleAlert className="h-3.5 w-3.5" />
                </div>
                <span>错题</span>
              </div>
              <span className="font-medium text-slate-700">{stats.wrongCount}</span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-200 py-2">
              <div className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-green-500 text-white">
                  <BookOpenCheck className="h-3.5 w-3.5" />
                </div>
                <span>笔记</span>
              </div>
              <span className="font-medium text-slate-700">{stats.noteCount}</span>
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-yellow-500 text-white">
                  <Star className="h-3.5 w-3.5" />
                </div>
                <span>收藏</span>
              </div>
              <span className="font-medium text-slate-700">{stats.favoriteCount}</span>
            </div>
          </div>
        </Card>

        <Card className="border-dashed p-4 text-sm text-slate-500">
          当前首页已按参考稿统一了功能卡、专项练习、历史和统计区的基础样式，并补了折叠态、按钮禁用态和空状态。
        </Card>
      </div>
    </div>
  );
}
