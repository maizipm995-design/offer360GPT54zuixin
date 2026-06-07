'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCampusExamAccess } from '@/components/campus-exam/use-campus-exam-access';
import { SeoHiddenContent } from '@/components/common/seo-hidden-content';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { clientFetch } from '@/lib/api';
import type { CampusExamSpecialDetail } from '@/lib/campus-exam';

type CampusExamSpecialPageClientProps = {
  initialData: CampusExamSpecialDetail;
  specialId: string;
};

export function CampusExamSpecialPageClient({
  initialData,
  specialId,
}: CampusExamSpecialPageClientProps) {
  const { ensurePracticeAccess, accessDialog, token } = useCampusExamAccess();
  const [data, setData] = useState(initialData);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useEffect(() => {
    if (!token) {
      return;
    }
    clientFetch<CampusExamSpecialDetail>(`/campus-exam/specials/${specialId}`, undefined, token)
      .then((result) => setData(result))
      .catch(() => {
        // 忽略登录态增强失败，保留首屏服务端渲染结果。
      });
  }, [specialId, token]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/campus-exam" className="hover:text-brand">笔试真题</Link>
        <span>/</span>
        <Link href={`/campus-exam/category/${data.category.slug}`} className="hover:text-brand">{data.category.name}</Link>
        <span>/</span>
        <span className="text-slate-900">{data.name}</span>
      </div>

      <Card className="p-6 lg:p-8">
        <p className="text-sm font-medium text-brand">专项顺序练习</p>
        <h1 className="mt-3 text-3xl font-bold text-ink">{data.name}</h1>
        <p className="mt-2 text-sm text-slate-500">{data.category.name}</p>
        {data.description ? <p className="mt-3 text-sm leading-7 text-slate-600">{data.description}</p> : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={`/campus-exam/special/${specialId}/practice`}
            onClick={(event) => {
              if (!ensurePracticeAccess({
                guestMessage: '专项顺序练习需登录或注册后使用，请先完成账号登录。',
                memberMessage: '专项顺序练习需开通标准会员或超级会员后使用。',
              })) {
                event.preventDefault();
              }
            }}
          >
            <Button>开始顺序练习</Button>
          </Link>
          {data.latestSession?.sessionId ? (
            <Link
              href={`/campus-exam/special/${specialId}/practice?sessionId=${data.latestSession.sessionId}`}
              onClick={(event) => {
                if (!ensurePracticeAccess({
                  guestMessage: '继续专项练习需登录或注册后使用，请先完成账号登录。',
                  memberMessage: '继续专项练习需开通标准会员或超级会员后使用。',
                })) {
                  event.preventDefault();
                }
              }}
            >
              <Button variant="secondary">继续顺序练习</Button>
            </Link>
          ) : null}
        </div>
      </Card>

      <SeoHiddenContent
        title="专项页 SEO 隐藏内容"
        paragraphs={[
          `${data.name} 页面聚合专项顺序练习、题型分布、难度分布、题目解析与所属分类等信息，用于承接校招笔试真题和专项刷题的深层搜索流量。`,
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-ink">题型分布</h2>
          <div className="mt-4 space-y-3">
            {data.questionTypeDistribution.map((item) => (
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
            {data.difficultyDistribution.map((item) => (
              <div key={item.difficulty} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="text-sm text-ink">难度 {item.difficulty}</span>
                <span className="text-sm font-medium text-slate-600">{item.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Link
        href={`/campus-exam/category/${data.category.slug}`}
        className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
      >
        返回 {data.category.name} 分类
      </Link>
      {accessDialog}
    </div>
  );
}
