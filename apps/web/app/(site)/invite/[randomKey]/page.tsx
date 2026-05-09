import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { serverGet } from '@/lib/api';

interface InviteLandingData {
  randomKey: string;
  inviteCode: string;
  inviter: {
    id: string;
    name: string;
    maskedPhone: string;
  };
  inviteStats: {
    inviteCount: number;
  };
  heroTitle: string;
  heroDescription: string;
  benefits: string[];
}

export default async function InviteLandingPage({ params }: { params: { randomKey: string } }) {
  let data: InviteLandingData | null = null;
  let errorMessage = '';

  try {
    data = await serverGet<InviteLandingData>(`/invite-links/${params.randomKey}`);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : '邀请链接无效';
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-60px)] max-w-[1366px] items-center px-4 py-10 lg:px-8">
      <div className="grid w-full gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[32px] bg-gradient-to-br from-brand via-orange-500 to-amber-400 p-8 text-white shadow-card lg:p-12">
          <p className="inline-flex rounded-full bg-white/15 px-4 py-1 text-sm">offer360 邀请中转页</p>
          <h1 className="mt-6 text-3xl font-bold leading-tight lg:text-5xl">{data?.heroTitle || '邀请链接暂不可用'}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/90 lg:text-base">
            {data?.heroDescription || '当前邀请链接不存在、已失效，或者邀请人暂时不可用。你仍然可以直接进入平台注册体验。'}
          </p>

          {data ? (
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/15 bg-white/10 p-5">
                <p className="text-sm text-white/80">邀请人</p>
                <p className="mt-2 text-2xl font-bold">{data.inviter.name}</p>
                <p className="mt-2 text-sm text-white/80">手机号：{data.inviter.maskedPhone}</p>
              </div>
              <div className="rounded-3xl border border-white/15 bg-white/10 p-5">
                <p className="text-sm text-white/80">累计邀请</p>
                <p className="mt-2 text-2xl font-bold">{data.inviteStats.inviteCount}</p>
                <p className="mt-2 text-sm text-white/80">邀请码：{data.inviteCode}</p>
              </div>
            </div>
          ) : null}
        </section>

        <Card className="p-6 lg:p-8">
          <h2 className="text-2xl font-bold text-ink">{data ? '通过统一入口完成注册' : '邀请状态提示'}</h2>
          <p className="mt-2 text-sm text-muted">
            {data ? '继续进入统一登录/注册入口后，系统会自动保留邀请码并在注册成功时绑定邀请关系。' : errorMessage || '请直接返回平台注册或登录。'}
          </p>

          {data ? (
            <div className="mt-6 space-y-3">
              {data.benefits.map((item) => (
                <div key={item} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  {item}
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href={data ? `/register?inviteCode=${encodeURIComponent(data.inviteCode)}` : '/register'} className="inline-flex flex-1 items-center justify-center rounded-2xl bg-brand px-5 py-3 text-sm font-medium text-white transition hover:bg-brand/90">
              {data ? '带邀请码去注册' : '去注册'}
            </Link>
            <Link href="/login" className="inline-flex flex-1 items-center justify-center rounded-2xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
              已有账号去登录
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}
