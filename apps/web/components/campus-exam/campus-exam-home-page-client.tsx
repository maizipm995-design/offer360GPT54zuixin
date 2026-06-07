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
import { SeoLinkCluster } from '@/components/common/seo-link-cluster';
import { useCampusExamAccess } from '@/components/campus-exam/use-campus-exam-access';
import { Card } from '@/components/ui/card';
import { clientFetch } from '@/lib/api';
import {
  formatPercentValue,
  getPracticeEntryHref,
  getPracticeSessionHref,
  type CampusExamHistoryItem,
  type CampusExamHomePayload,
} from '@/lib/campus-exam';
import { formatDate } from '@/lib/utils';

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

function getHistoryRateText(item: CampusExamHistoryItem) {
  return item.status === 'completed'
    ? `最终得分率 ${formatPercentValue(item.scoreRate)}`
    : `当前得分率 ${formatPercentValue(item.currentScoreRate)}`;
}

function getHistoryActionLabel(item: CampusExamHistoryItem) {
  return item.status === 'completed' ? '查看详情' : '继续做题';
}

function buildPracticeAccessCopy(featureName: string) {
  return {
    guestMessage: `${featureName}需登录或注册后使用，请先完成账号登录。`,
    memberMessage: `${featureName}需开通标准会员或超级会员后使用。`,
  };
}

type CampusExamHomePageClientProps = {
  initialData: CampusExamHomePayload | null;
};

export function CampusExamHomePageClient({ initialData }: CampusExamHomePageClientProps) {
  const { token, ensureLoginAccess, ensurePracticeAccess, accessDialog } = useCampusExamAccess('/campus-exam');
  const [data, setData] = useState<CampusExamHomePayload | null>(initialData);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!initialData);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string>('');

  useEffect(() => {
    setData(initialData);
    setLoading(!initialData);
  }, [initialData]);

  useEffect(() => {
    let active = true;
    setLoading(!initialData);
    setError('');
    clientFetch<CampusExamHomePayload>('/campus-exam/home', undefined, token ?? undefined)
      .then((result) => {
        if (!active) return;
        setData(result);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : '笔试真题页面加载失败');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [initialData, token]);

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

  useEffect(() => {
    setExpandedCategoryId('');
  }, [data?.categoryTree]);

  const handleCategoryToggle = (categoryId: string) => {
    setExpandedCategoryId((current) => (current === categoryId ? '' : categoryId));
  };

  const stats = data?.stats ?? defaultStats;
  const hasCategoryData = categoryWithTotals.length > 0;
  const hasHistoryData = Boolean(data?.history?.length);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 bg-slate-50 px-4 py-6 lg:flex-row lg:px-6">
      <div className="min-w-0 flex-1 space-y-6">
        <Card className="overflow-hidden border-0 bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] p-0 text-white shadow-card">
          <div className="px-6 py-6 lg:px-8">
            <p className="text-sm font-medium text-white/80">笔试真题</p>
            <h1 className="mt-3 text-3xl font-bold">名企笔试真题与专项练习入口</h1>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-white/85">
              汇总名企笔试真题、分类题库、专项顺序练习、快速刷题与模考训练，帮助大学生和应届生系统提升笔试表现。
            </p>
          </div>
        </Card>

        <div className="grid grid-cols-3 gap-2 md:gap-4">
          {heroCards.map((card) => {
            const config = heroCardConfig[card.code];
            const Icon = config?.icon ?? PenLine;
            const href = card.enabled ? getPracticeEntryHref(card.code) : null;
            const buttonEnabled = Boolean(card.enabled && href);
            const cardContent = (
              <Card
                key={card.code}
                className={`relative overflow-hidden border-0 bg-gradient-to-br ${config?.gradient ?? 'from-brand to-brand-dark'} p-3 text-white shadow-card transition md:p-5 ${
                  buttonEnabled ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-xl' : ''
                }`}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.22),_transparent_42%)]" />
                <div className="relative z-10 flex min-h-[140px] flex-col items-center text-center md:min-h-[176px] md:items-stretch md:text-left">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] bg-white/14 shadow-[0_10px_24px_rgba(255,255,255,0.14)] md:hidden">
                    <Icon className="h-7 w-7 text-white md:h-9 md:w-9" />
                  </div>
                  <div className="mt-3 md:mt-0">
                    <p className="text-base font-semibold leading-6 tracking-[0.01em] md:text-[22px] md:leading-8">
                      {card.title}
                    </p>
                    <p className="mt-2 hidden max-w-[240px] text-sm leading-6 text-white/85 md:block">
                      {config?.description}
                    </p>
                  </div>
                  <div className="mt-auto flex w-full items-end justify-center pt-3 md:justify-between md:gap-4 md:pt-8">
                    <div className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-white/14 shadow-[0_12px_30px_rgba(255,255,255,0.14)] md:flex">
                      <Icon className="h-9 w-9 text-white" />
                    </div>
                    {buttonEnabled ? (
                      <span className="inline-flex items-center self-center rounded-full bg-white/18 px-2.5 py-1 text-[11px] font-medium text-white md:self-end md:px-3 md:py-1.5 md:text-xs">
                        <span className="md:hidden">开始练习</span>
                        <span className="hidden md:inline">{config.actionLabel}</span>
                        <ChevronRight className="ml-0.5 h-3 w-3 md:ml-1 md:h-3.5 md:w-3.5" />
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="inline-flex cursor-not-allowed items-center self-center rounded-full bg-white/12 px-2.5 py-1 text-[11px] font-medium text-white/70 md:self-end md:px-3 md:py-1.5 md:text-xs"
                      >
                        {card.enabled ? '暂未开放' : '敬请期待'}
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            );
            return buttonEnabled && href ? (
              <Link
                key={card.code}
                href={href}
                className="block min-w-0"
                aria-label={`进入${card.title}`}
                onClick={(event) => {
                  if (!ensurePracticeAccess(buildPracticeAccessCopy(card.title))) {
                    event.preventDefault();
                  }
                }}
              >
                {cardContent}
              </Link>
            ) : (
              cardContent
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
                onClick={(event) => {
                  if (!ensurePracticeAccess(buildPracticeAccessCopy('自定义刷题'))) {
                    event.preventDefault();
                  }
                }}
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
                    onClick={() => handleCategoryToggle(category.id)}
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
                            onClick={(event) => {
                              if (!ensurePracticeAccess(buildPracticeAccessCopy('分类顺序练习'))) {
                                event.preventDefault();
                              }
                            }}
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
                                    onClick={(event) => {
                                      if (!ensurePracticeAccess(buildPracticeAccessCopy('专项顺序练习'))) {
                                        event.preventDefault();
                                      }
                                    }}
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
          <Card className="p-6 text-sm text-slate-500">正在加载笔试真题页面...</Card>
        ) : null}
        {error ? (
          <Card className="border-rose-100 bg-rose-50 p-6 text-sm text-rose-500">{error}</Card>
        ) : null}
        <SeoLinkCluster
          currentPath="/campus-exam"
          title="相关求职入口"
          description="完成笔试真题练习后，可继续查看名企校招、完善 AI简历优化、进入面试辅导或浏览求职服务。"
        />
      </div>

      <div className="w-full space-y-6 lg:w-80">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">练习历史</h2>
            <Link
              href="/campus-exam/history"
              className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700"
              onClick={(event) => {
                if (!ensureLoginAccess('练习历史需登录后查看，请先登录或注册。')) {
                  event.preventDefault();
                }
              }}
            >
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
                          {item.status === 'completed'
                            ? getHistoryRateText(item)
                            : `进度 ${item.answeredCount}/${item.totalQuestions}`}
                        </span>
                        {item.status !== 'completed' ? <span>{getHistoryRateText(item)}</span> : null}
                        <span>{formatDate(item.updatedAt)}</span>
                      </div>
                      {item.status !== 'completed' ? (
                        <p className="mt-2 text-xs text-slate-500">继续完成剩余题目后，可查看本次练习最终详情。</p>
                      ) : null}
                    </div>
                    {canResume ? (
                      <Link
                        href={getPracticeSessionHref(item)}
                        className="shrink-0 rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-500 transition hover:bg-rose-100"
                      >
                        {getHistoryActionLabel(item)}
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

            <Link
              href="/campus-exam/practice?mode=wrong_practice"
              className="flex items-center justify-between border-b border-slate-200 py-2 transition hover:text-brand"
              onClick={(event) => {
                if (!ensurePracticeAccess(buildPracticeAccessCopy('错题顺序练习'))) {
                  event.preventDefault();
                }
              }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-orange-500 text-white">
                  <TriangleAlert className="h-3.5 w-3.5" />
                </div>
                <span>错题</span>
              </div>
              <span className="inline-flex items-center gap-2 font-medium text-slate-700">
                {stats.wrongCount}
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </span>
            </Link>

            <Link
              href="/campus-exam/practice?mode=favorite_practice"
              className="flex items-center justify-between py-2 transition hover:text-brand"
              onClick={(event) => {
                if (!ensurePracticeAccess(buildPracticeAccessCopy('收藏顺序练习'))) {
                  event.preventDefault();
                }
              }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-yellow-500 text-white">
                  <Star className="h-3.5 w-3.5" />
                </div>
                <span>收藏</span>
              </div>
              <span className="inline-flex items-center gap-2 font-medium text-slate-700">
                {stats.favoriteCount}
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </span>
            </Link>
          </div>
        </Card>
      </div>
      {accessDialog}
    </div>
  );
}
