import { ResumeDocument } from '@/components/resume/resume-document';
import {
  normalizeResumeContent,
  normalizeResumeLayout,
  normalizeResumeStyle,
  type ResumeDraftRecord,
} from '@/components/resume/resume-types';
import { serverGet } from '@/lib/api';

export const dynamic = 'force-dynamic';

interface ResumePrintPageProps {
  params: { resumeId: string };
  searchParams?: { printToken?: string | string[] };
}

export default async function ResumePrintPage({ params, searchParams }: ResumePrintPageProps) {
  const rawToken = Array.isArray(searchParams?.printToken) ? searchParams?.printToken[0] : searchParams?.printToken ?? '';
  const query = new URLSearchParams({ token: rawToken });

  let draft: ResumeDraftRecord | null = null;
  let errorMessage = '';

  try {
    draft = await serverGet<ResumeDraftRecord>(`/resume-drafts/print/${params.resumeId}?${query.toString()}`);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : '打印页加载失败';
  }

  if (!draft) {
    return (
      <main className="min-h-screen bg-white px-6 py-10 text-slate-700">
        <div className="mx-auto max-w-2xl rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-8 py-12 text-center">
          <p className="text-lg font-semibold text-slate-900">简历打印页暂时不可用</p>
          <p className="mt-3 text-sm leading-7 text-slate-600">{errorMessage || '请返回编辑页重新发起导出。'}</p>
        </div>
      </main>
    );
  }

  const content = normalizeResumeContent(draft.contentJson);
  const styleConfig = normalizeResumeStyle(draft.styleJson);
  const layout = normalizeResumeLayout(draft.layoutJson);

  return (
    <main className="bg-white">
      <ResumeDocument content={content} styleConfig={styleConfig} layout={layout} mode="print" />
    </main>
  );
}
