'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { clientFetch } from '@/lib/api';
import type { CampusExamCategoryTreeItem } from '@/lib/campus-exam';

type CategoryDetail = Omit<CampusExamCategoryTreeItem, 'specials'> & {
  specials: Array<{ id: number; name: string; description?: string | null; questionCount: number }>;
};

export default function CampusExamCategoryPage() {
  const params = useParams<{ categorySlug: string }>();
  const [data, setData] = useState<CategoryDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const slug = params?.categorySlug;
    if (!slug) return;
    clientFetch<CategoryDetail>(`/campus-exam/categories/${slug}`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : '分类详情加载失败'));
  }, [params]);

  if (error) {
    return <div className="mx-auto max-w-4xl px-4 py-8 text-sm text-rose-500">{error}</div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 bg-slate-50 px-4 py-6 lg:px-6">
      <Card className="overflow-hidden border-0 bg-gradient-to-r from-[#6B8AFF] to-[#406AFF] p-0 text-white shadow-card">
        <div className="px-6 py-6 lg:px-8">
          <p className="text-sm font-medium text-white/80">专项列表</p>
          <h1 className="mt-3 text-3xl font-bold">{data?.name ?? '分类详情'}</h1>
          {data?.description ? <p className="mt-3 max-w-3xl text-sm leading-7 text-white/85">{data.description}</p> : null}
          {data?.id ? (
            <div className="mt-5">
              <Link
                href={`/campus-exam/practice?mode=category_practice&categoryId=${data.id}`}
                className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-medium text-brand transition hover:bg-white/90"
              >
                练习本分类全部题目
              </Link>
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
          <div className="inline-flex items-center rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white">
            可练专项
          </div>
          <span className="text-sm text-slate-500">共 {(data?.specials ?? []).length} 个专项</span>
        </div>

        <div className="divide-y divide-slate-100">
          {(data?.specials ?? []).map((special) => (
            <div key={special.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition hover:bg-slate-50">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-base font-semibold text-ink">{special.name}</h2>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">共 {special.questionCount} 题</span>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  {special.description || '进入该二级分类后会按题库固有顺序逐题作答，支持题卡回溯与继续练习。'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Link
                  href={`/campus-exam/special/${special.id}`}
                  className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
                >
                  查看详情
                </Link>
                <Link
                  href={`/campus-exam/special/${special.id}/practice`}
                  className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark"
                >
                  顺序练习
                </Link>
              </div>
            </div>
          ))}

          {!data?.specials?.length ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              当前分类下暂未配置专项，稍后可回到首页查看其他分类。
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
