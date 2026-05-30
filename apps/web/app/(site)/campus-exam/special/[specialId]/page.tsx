'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { clientFetch } from '@/lib/api';
import type { CampusExamSpecialDetail } from '@/lib/campus-exam';

export default function CampusExamSpecialPage() {
  const params = useParams<{ specialId: string }>();
  const [data, setData] = useState<CampusExamSpecialDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!params?.specialId) return;
    clientFetch<CampusExamSpecialDetail>(`/campus-exam/specials/${params.specialId}`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : '专项详情加载失败'));
  }, [params]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 lg:px-6">
      <Card className="p-6 lg:p-8">
        <p className="text-sm font-medium text-brand">专项顺序练习</p>
        <h1 className="mt-3 text-3xl font-bold text-ink">{data?.name ?? '专项详情'}</h1>
        <p className="mt-2 text-sm text-slate-500">{data?.category.name}</p>
        {data?.description ? <p className="mt-3 text-sm leading-7 text-slate-600">{data.description}</p> : null}
        {error ? <p className="mt-3 text-sm text-rose-500">{error}</p> : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={`/campus-exam/special/${params?.specialId}/practice`}>
            <Button>开始顺序练习</Button>
          </Link>
          {data?.latestSession?.sessionId ? (
            <Link href={`/campus-exam/special/${params?.specialId}/practice?sessionId=${data.latestSession.sessionId}`}>
              <Button variant="secondary">继续顺序练习</Button>
            </Link>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-ink">题型分布</h2>
          <div className="mt-4 space-y-3">
            {(data?.questionTypeDistribution ?? []).map((item) => (
              <div key={item.questionType} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="text-sm text-ink">{item.label}</span>
                <span className="text-sm font-medium text-slate-600">{item.count}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold text-ink">难度分布</h2>
          <div className="mt-4 space-y-3">
            {(data?.difficultyDistribution ?? []).map((item) => (
              <div key={item.difficulty} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="text-sm text-ink">难度 {item.difficulty}</span>
                <span className="text-sm font-medium text-slate-600">{item.count}</span>
              </div>
            ))}
            <div className="rounded-2xl bg-brand/5 px-4 py-4 text-sm text-brand">
              当前二级分类共 {data?.questionCount ?? 0} 道题，进入后会按固有顺序逐题作答，支持客观题即时判分与简答题自动评分。
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
