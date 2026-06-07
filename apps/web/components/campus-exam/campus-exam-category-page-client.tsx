'use client';

import Link from 'next/link';
import { useCampusExamAccess } from '@/components/campus-exam/use-campus-exam-access';
import { SeoHiddenContent } from '@/components/common/seo-hidden-content';
import { Card } from '@/components/ui/card';
import type { CampusExamCategoryDetail } from '@/lib/campus-exam';

export function CampusExamCategoryPageClient({ data }: { data: CampusExamCategoryDetail }) {
  const { ensurePracticeAccess, accessDialog } = useCampusExamAccess();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 bg-slate-50 px-4 py-6 lg:px-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/campus-exam" className="hover:text-brand">笔试真题</Link>
        <span>/</span>
        <span className="text-slate-900">{data.name}</span>
      </div>

      <Card className="overflow-hidden border-0 bg-gradient-to-r from-[#6B8AFF] to-[#406AFF] p-0 text-white shadow-card">
        <div className="px-6 py-6 lg:px-8">
          <p className="text-sm font-medium text-white/80">专项列表</p>
          <h1 className="mt-3 text-3xl font-bold">{data.name}</h1>
          {data.description ? (
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/85">{data.description}</p>
          ) : null}
          <div className="mt-5">
            <Link
              href={`/campus-exam/practice?mode=category_practice&categoryId=${data.id}`}
              className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-medium text-brand transition hover:bg-white/90"
              onClick={(event) => {
                if (!ensurePracticeAccess({
                  guestMessage: '分类顺序练习需登录或注册后使用，请先完成账号登录。',
                  memberMessage: '分类顺序练习需开通标准会员或超级会员后使用。',
                })) {
                  event.preventDefault();
                }
              }}
            >
              练习本分类全部题目
            </Link>
          </div>
        </div>
      </Card>

      <SeoHiddenContent
        title="分类页 SEO 隐藏内容"
        paragraphs={[
          `${data.name} 是 Offer360 笔试真题题库的重要分类页，页面聚合多个专项练习入口，覆盖分类刷题、专项刷题、题目解析与校招笔试练习等搜索语义。`,
        ]}
      />

      <section className="space-y-6">
        <div className="space-y-6">
          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
              <div className="inline-flex items-center rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white">
                可练专项
              </div>
              <span className="text-sm text-slate-500">共 {data.specials.length} 个专项</span>
            </div>

            <div className="divide-y divide-slate-100">
              {data.specials.map((special) => (
                <div key={special.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-base font-semibold text-ink">{special.name}</h2>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">共 {special.questionCount} 题</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                      {special.description || `进入 ${special.name} 专项后，你可以按顺序进行题目练习，每道题均配有专业解析，适合深度学习。`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Link
                      href={`/campus-exam/special/${special.id}`}
                      className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
                    >
                      查看专项详情
                    </Link>
                    <Link
                      href={`/campus-exam/special/${special.id}/practice`}
                      className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark"
                      onClick={(event) => {
                        if (!ensurePracticeAccess({
                          guestMessage: '专项顺序练习需登录或注册后使用，请先完成账号登录。',
                          memberMessage: '专项顺序练习需开通标准会员或超级会员后使用。',
                        })) {
                          event.preventDefault();
                        }
                      }}
                    >
                      开始专项练习
                    </Link>
                  </div>
                </div>
              ))}

              {!data.specials.length ? (
                <div className="px-6 py-12 text-center text-sm text-slate-500">
                  当前分类下暂未配置专项，稍后可回到首页查看其他分类。
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      </section>
      <Link
        href="/campus-exam"
        className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
      >
        返回笔试真题首页
      </Link>
      {accessDialog}
    </div>
  );
}
