'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { clientFetch } from '@/lib/api';
import { getPracticeSessionHref, type CampusExamHistoryItem } from '@/lib/campus-exam';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';

export default function CampusExamHistoryPage() {
  const token = useAuthStore((state) => state.token);
  const [history, setHistory] = useState<CampusExamHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setHistory([]);
      return;
    }
    clientFetch<CampusExamHistoryItem[]>('/campus-exam/history', undefined, token)
      .then(setHistory)
      .catch((err) => setError(err instanceof Error ? err.message : '练习历史加载失败'))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 bg-slate-50 px-4 py-6 lg:px-6">
      <Card className="overflow-hidden border-0 bg-gradient-to-r from-[#6B8AFF] to-[#406AFF] p-0 text-white shadow-card">
        <div className="px-6 py-6 lg:px-8">
          <p className="text-sm font-medium text-white/80">练习历史</p>
          <h1 className="mt-3 text-3xl font-bold">校招笔试练习历史</h1>
          <p className="mt-3 text-sm leading-7 text-white/85">查看快速练习、智能模考、错题重练和顺序练习的进度，支持继续做题、查看结算和回看最后一题。</p>
        </div>
      </Card>

      {!token ? <Card className="p-6 text-sm text-slate-500">请先登录后查看练习历史。</Card> : null}
      {loading ? <Card className="p-6 text-sm text-slate-500">练习历史加载中...</Card> : null}
      {error ? <Card className="p-6 text-sm text-rose-500">{error}</Card> : null}

      <div className="space-y-4">
        {history.map((item) => (
          <Card key={item.sessionId} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-ink">{item.title}</h2>
                <p className="mt-2 text-sm text-slate-500">
                  {[item.categoryName, item.specialName].filter(Boolean).join(' · ') || '综合练习模式'}
                </p>
                <p className="mt-2 text-xs text-slate-400">创建时间：{formatDate(item.createdAt)} · 最近更新：{formatDate(item.updatedAt)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <p>进度：{item.answeredCount}/{item.totalQuestions}</p>
                <p className="mt-1">答对：{item.correctCount}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={getPracticeSessionHref(item)}
                className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white"
              >
                {item.status === 'completed' ? '查看结算' : '继续做题'}
              </Link>
              {item.lastQuestionId ? (
                <Link
                  href={`/campus-exam/question/${item.lastQuestionId}?sessionId=${item.sessionId}`}
                  className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  回看最后一题
                </Link>
              ) : null}
            </div>
          </Card>
        ))}
        {!loading && token && !history.length ? (
          <Card className="p-6 text-sm text-slate-500">你还没有练习记录，可以先去首页选择一个专项开始刷题。</Card>
        ) : null}
      </div>
    </div>
  );
}
