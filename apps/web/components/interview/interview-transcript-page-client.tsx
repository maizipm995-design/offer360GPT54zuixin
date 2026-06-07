'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileText, LoaderCircle, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ResumeDraftListResponse, ResumeDraftRecord } from '@/components/resume/resume-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { clientFetch, clientUpload } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { showToast } from '@/store/toast-store';

type ResumeMode = 'structured' | 'upload';
type RecordStatus = 'processing' | 'completed' | 'failed';
type OutputMode = 'url' | 'text';

type TranscriptRecord = {
  id: string;
  companyName: string;
  jobName: string;
  interviewType: string;
  jobRequirement: string;
  resumeMode: ResumeMode;
  structuredResumeTitle: string | null;
  uploadedFileName: string | null;
  status: RecordStatus;
  outputMode: OutputMode | null;
  downloadUrl: string | null;
  finalOutput: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

type TranscriptQuotaSummary = {
  freeRemainingCount: number;
  superRemainingCount: number;
  availableRemainingCount: number;
  activeQuotaType: 'free' | 'super';
  hasActiveSuperMembership: boolean;
};

type PromptDialogState =
  | { type: 'login-required' }
  | { type: 'quota-exhausted' }
  | { type: 'first-free-confirm' };

const INTERVIEW_RECORD_IDS_STORAGE_KEY = 'offer360.interview-transcript.record-ids';
const MAX_LOCAL_RECORD_COUNT = 30;
const POLLING_INTERVAL_MS = 8000;
const INTERVIEW_TYPE_OPTIONS = ['通用综合面试', 'HR面试', '业务面试', '总监面试', 'AI面试'] as const;
const ACCEPTED_RESUME_FILE_TYPES = '.doc,.docx,.pdf,.ppt,.pptx,image/*';
const SUBMIT_SUCCESS_MESSAGE =
  '已成功提交请求，逐字稿正在生成中，请等待5-10分钟，生成完成后可在【生成记录】中查看并下载';

function parseStoredRecordIds(value: string | null) {
  if (!value) {
    return [] as string[];
  }
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  } catch {
    return [];
  }
}

function buildWordBlob(content: string) {
  const escaped = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r\n/g, '\n')
    .replace(/\n/g, '<br />');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body>${escaped}</body></html>`;
  return new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
}

function buildDownloadFileName(record: TranscriptRecord) {
  const company = record.companyName.trim() || '公司';
  const job = record.jobName.trim() || '岗位';
  return `${company}-${job}-面试逐字稿.doc`;
}

function mergeRecords(current: TranscriptRecord[], incoming: TranscriptRecord[]) {
  const nextMap = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) {
    nextMap.set(item.id, item);
  }
  return [...nextMap.values()].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

function isSameStringArray(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((item, index) => item === right[index]);
}

export function InterviewTranscriptPageClient() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const hasProcessingRecordsRef = useRef(false);
  const [companyName, setCompanyName] = useState('');
  const [jobName, setJobName] = useState('');
  const [interviewType, setInterviewType] = useState<(typeof INTERVIEW_TYPE_OPTIONS)[number] | ''>('');
  const [jobRequirement, setJobRequirement] = useState('');
  const [resumeMode, setResumeMode] = useState<ResumeMode>('structured');
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [selectedResumeTitle, setSelectedResumeTitle] = useState('');
  const [uploadedResumeFile, setUploadedResumeFile] = useState<File | null>(null);
  const [recordIds, setRecordIds] = useState<string[]>([]);
  const [records, setRecords] = useState<TranscriptRecord[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [recordsReady, setRecordsReady] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  const [quotaSummary, setQuotaSummary] = useState<TranscriptQuotaSummary | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [promptDialog, setPromptDialog] = useState<PromptDialogState | null>(null);
  const [resumeDrafts, setResumeDrafts] = useState<ResumeDraftRecord[]>([]);
  const [loadingResumeDrafts, setLoadingResumeDrafts] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    setRecordIds(parseStoredRecordIds(window.localStorage.getItem(INTERVIEW_RECORD_IDS_STORAGE_KEY)).slice(0, MAX_LOCAL_RECORD_COUNT));
    setRecordsReady(true);
  }, []);

  useEffect(() => {
    if (!recordsReady || typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(INTERVIEW_RECORD_IDS_STORAGE_KEY, JSON.stringify(recordIds.slice(0, MAX_LOCAL_RECORD_COUNT)));
  }, [recordIds, recordsReady]);

  useEffect(() => {
    if (!token) {
      setQuotaSummary(null);
      setResumeDrafts([]);
      setSelectedResumeId('');
      setSelectedResumeTitle('');
      return;
    }

    let cancelled = false;
    setLoadingResumeDrafts(true);
    clientFetch<ResumeDraftListResponse>('/me/resume-drafts', {}, token)
      .then((response) => {
        if (!cancelled) {
          setResumeDrafts(response.list ?? []);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          showToast(error instanceof Error ? error.message : '结构化简历列表加载失败');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingResumeDrafts(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const refreshQuota = useCallback(
    async (silent = false) => {
      if (!token) {
        setQuotaSummary(null);
        return null;
      }

      if (!silent) {
        setQuotaLoading(true);
      }

      try {
        const summary = await clientFetch<TranscriptQuotaSummary>('/interview-transcripts/quota', {}, token);
        setQuotaSummary(summary);
        return summary;
      } catch (error) {
        if (!silent) {
          showToast(error instanceof Error ? error.message : '生成次数加载失败');
        }
        return null;
      } finally {
        if (!silent) {
          setQuotaLoading(false);
        }
      }
    },
    [token],
  );

  useEffect(() => {
    if (!token) {
      return;
    }
    void refreshQuota();
  }, [refreshQuota, token]);

  useEffect(() => {
    hasProcessingRecordsRef.current = records.some((item) => item.status === 'processing');
  }, [records]);

  useEffect(() => {
    if (!recordsReady || !recordIds.length) {
      if (recordsReady && !recordIds.length) {
        setRecords([]);
      }
      return;
    }

    let cancelled = false;

    const syncRecords = async (silent = false) => {
      try {
        const response = await clientFetch<TranscriptRecord[]>('/interview-transcripts/tasks/query', {
          method: 'POST',
          body: JSON.stringify({ ids: recordIds }),
        });
        if (cancelled) {
          return;
        }
        setRecords(response);
        const nextRecordIds = response.map((item) => item.id).slice(0, MAX_LOCAL_RECORD_COUNT);
        setRecordIds((current) => (isSameStringArray(current, nextRecordIds) ? current : nextRecordIds));
        if (token) {
          void refreshQuota(true);
        }
      } catch (error) {
        if (!silent && !cancelled) {
          showToast(error instanceof Error ? error.message : '生成记录加载失败');
        }
      }
    };

    void syncRecords();

    const timer = window.setInterval(() => {
      if (!hasProcessingRecordsRef.current) {
        return;
      }
      void syncRecords(true);
    }, POLLING_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [recordIds, recordsReady]);

  const sortedRecords = useMemo(
    () => [...records].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()),
    [records],
  );

  const resetResumeInput = () => {
    setSelectedResumeId('');
    setSelectedResumeTitle('');
    setUploadedResumeFile(null);
  };

  const handleResumeModeChange = (nextMode: ResumeMode) => {
    setResumeMode(nextMode);
    resetResumeInput();
  };

  const handleFileDownload = (record: TranscriptRecord) => {
    if (record.outputMode === 'url' && record.downloadUrl) {
      window.open(record.downloadUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (record.outputMode === 'text' && record.finalOutput) {
      const blob = buildWordBlob(record.finalOutput);
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = buildDownloadFileName(record);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
      return;
    }
    showToast('当前记录暂无可下载内容');
  };

  const validateBeforeSubmit = () => {
    if (!companyName.trim()) {
      showToast('请填写面试公司名称');
      return false;
    }
    if (!jobName.trim()) {
      showToast('请填写面试岗位名称');
      return false;
    }
    if (!interviewType) {
      showToast('请选择面试类型');
      return false;
    }
    if (resumeMode === 'structured' && !selectedResumeId) {
      showToast('请选择一份站内结构化简历');
      return false;
    }
    if (resumeMode === 'upload' && !uploadedResumeFile) {
      showToast('请上传本地简历附件');
      return false;
    }

    return true;
  };

  const submitTranscriptRequest = useCallback(async () => {
    if (submitting || !token) {
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('companyName', companyName.trim());
      formData.append('jobName', jobName.trim());
      formData.append('interviewType', interviewType);
      formData.append('jobRequirement', jobRequirement.trim());
      formData.append('resumeMode', resumeMode);

      if (resumeMode === 'structured') {
        const detail = await clientFetch<ResumeDraftRecord>(`/me/resume-drafts/${selectedResumeId}`, {}, token || undefined);
        formData.append('structuredResume', JSON.stringify(detail.contentJson ?? {}));
        formData.append('structuredResumeTitle', detail.title || selectedResumeTitle || '未命名简历');
      } else if (uploadedResumeFile) {
        formData.append('resumeFile', uploadedResumeFile);
      }

      const createdRecord = await clientUpload<TranscriptRecord>('/interview-transcripts/requests', formData, {
        token: token || undefined,
        timeoutMs: 60 * 1000,
      });

      setRecords((prev) => mergeRecords(prev, [createdRecord]));
      setRecordIds((prev) => [createdRecord.id, ...prev.filter((item) => item !== createdRecord.id)].slice(0, MAX_LOCAL_RECORD_COUNT));
      setTipOpen(true);
      void refreshQuota(true);
      showToast('请求已提交，正在生成逐字稿', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : '面试辅导提交失败';
      if (message.includes('次数已用尽')) {
        setPromptDialog({ type: 'quota-exhausted' });
        void refreshQuota(true);
      } else {
        showToast(message);
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    companyName,
    interviewType,
    jobName,
    jobRequirement,
    refreshQuota,
    resumeMode,
    selectedResumeId,
    selectedResumeTitle,
    submitting,
    token,
    uploadedResumeFile,
  ]);

  const handleSubmitClick = async () => {
    if (submitting) {
      showToast('当前请求提交中，请稍候');
      return;
    }

    if (!validateBeforeSubmit()) {
      return;
    }

    if (!token) {
      setPromptDialog({ type: 'login-required' });
      return;
    }

    const latestQuota = quotaSummary ?? await refreshQuota();
    if (!latestQuota) {
      return;
    }

    if (latestQuota.availableRemainingCount <= 0) {
      setPromptDialog({ type: 'quota-exhausted' });
      return;
    }

    if (latestQuota.activeQuotaType === 'free' && latestQuota.availableRemainingCount === 1) {
      setPromptDialog({ type: 'first-free-confirm' });
      return;
    }

    await submitTranscriptRequest();
  };

  const quotaSummaryText = useMemo(() => {
    if (!token) {
      return '登录后可获得 1 次免费面试辅导机会，开通超级会员可解锁 20 次面试辅导机会。';
    }
    if (quotaLoading && !quotaSummary) {
      return '正在加载当前可用生成次数...';
    }
    if (!quotaSummary) {
      return '暂未获取到当前生成次数，请稍后重试。';
    }
    if (quotaSummary.activeQuotaType === 'super') {
      return `当前超级会员可用生成次数：${quotaSummary.availableRemainingCount}。每次开通或续费超级会员，都会新增 20 次生成机会。`;
    }
    return `当前免费生成次数：${quotaSummary.availableRemainingCount}/1。普通用户与标准会员统一仅有 1 次免费机会。`;
  }, [quotaLoading, quotaSummary, token]);

  return (
    <main className="mx-auto max-w-[1366px] px-4 py-8 lg:px-8">
      <section className="rounded-[32px] bg-white px-6 py-8 shadow-card lg:px-10 lg:py-10">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-bold text-slate-900 lg:text-4xl">面试辅导</h1>
          <p className="mt-3 text-sm leading-7 text-slate-500 lg:text-base">
            填写面试信息并选择简历来源后，即可发起逐字稿生成。简历内容仅用于本次工作流调用，生成完成后会立即清理。
          </p>
          <div className="mt-5 rounded-2xl border border-[#E8ECF3] bg-slate-50/80 px-4 py-4">
            <p className="text-sm font-semibold text-slate-900">
              {token && quotaSummary ? `当前可用次数：${quotaSummary.availableRemainingCount}` : '使用次数说明'}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">{quotaSummaryText}</p>
            {user?.memberRoleCode === 'SUPER_MEMBER' ? (
              <p className="mt-2 text-xs text-slate-400">当前账号已开通超级会员，续费后会同步顺延会员有效期，并额外新增 20 次逐字稿生成机会。</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <section className="rounded-[28px] bg-white p-6 shadow-card lg:p-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">信息填写</h2>
              <p className="mt-2 text-sm text-slate-500">带 * 字段为必填项，未填写完整不可提交。</p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <Field label="面试公司名称 *">
              <Input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="请输入面试公司名称" />
            </Field>
            <Field label="面试岗位名称 *">
              <Input value={jobName} onChange={(event) => setJobName(event.target.value)} placeholder="请输入面试岗位名称" />
            </Field>
            <Field label="面试类型 *">
              <select
                value={interviewType}
                onChange={(event) => setInterviewType(event.target.value as (typeof INTERVIEW_TYPE_OPTIONS)[number] | '')}
                className="flex h-10 w-full rounded-md border border-[#E5E6EB] bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-brand"
              >
                <option value="">请选择面试类型</option>
                {INTERVIEW_TYPE_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="岗位JD（选填）">
              <Input value={jobRequirement} onChange={(event) => setJobRequirement(event.target.value)} placeholder="可填写岗位任职要求 / JD" />
            </Field>
          </div>

          <div className="mt-8 rounded-2xl border border-[#E8ECF3] bg-slate-50/80 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">简历上传 / 选择 *</h3>
                <p className="mt-1 text-sm text-slate-500">两种模式二选一，提交时仅透传本次所需简历内容。</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <ModeCard
                title="模式一：选择本网站已保存的简历"
                description="选择本网站已保存的简历"
                active={resumeMode === 'structured'}
                onClick={() => handleResumeModeChange('structured')}
              />
              <ModeCard
                title="模式二：本地上传附件"
                description="支持 Word / PDF / 图片 / PPT 文件"
                active={resumeMode === 'upload'}
                onClick={() => handleResumeModeChange('upload')}
              />
            </div>

            {resumeMode === 'structured' ? (
              <div className="mt-5 rounded-2xl border border-dashed border-[#D8DEE8] bg-white p-4">
                {!token ? (
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <p className="text-sm text-slate-500">使用站内结构化简历前需要先登录账号。</p>
                    <Button type="button" onClick={() => router.push('/login')}>
                      去登录
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <select
                      value={selectedResumeId}
                      onChange={(event) => {
                        const nextId = event.target.value;
                        setSelectedResumeId(nextId);
                        const matched = resumeDrafts.find((item) => item.id === nextId);
                        setSelectedResumeTitle(matched?.title || '');
                      }}
                      className="flex h-10 w-full rounded-md border border-[#E5E6EB] bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-brand"
                    >
                      <option value="">{loadingResumeDrafts ? '结构化简历加载中...' : '请选择结构化简历'}</option>
                      {resumeDrafts.map((draft) => (
                        <option key={draft.id} value={draft.id}>
                          {draft.title || '未命名简历'}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs leading-5 text-slate-400">仅透传本次选中的结构化简历 JSON 数据，成功生成后立即清理。</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-[#D8DEE8] bg-white p-4">
                <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl bg-slate-50 px-4 py-8 text-center transition hover:bg-brand/5">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
                    <Upload className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{uploadedResumeFile ? uploadedResumeFile.name : '点击上传本地简历附件'}</p>
                    <p className="mt-1 text-xs text-slate-500">支持 Word、PDF、图片、PPT，附件不做额外留存。</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept={ACCEPTED_RESUME_FILE_TYPES}
                    onChange={(event) => setUploadedResumeFile(event.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-slate-500">提交后会立即加入生成记录，并自动同步生成状态。</p>
            <Button type="button" className="h-11 px-6" onClick={() => void handleSubmitClick()}>
              {submitting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              {submitting ? '提交中...' : '提交生成逐字稿'}
            </Button>
          </div>
        </section>

        <aside className="rounded-[28px] bg-white p-6 shadow-card lg:p-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">生成记录</h2>
              <p className="mt-2 text-sm text-slate-500">展示当前浏览器发起的逐字稿任务状态与下载入口。</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {sortedRecords.length ? (
              sortedRecords.map((record) => (
                <article key={record.id} className="rounded-2xl border border-[#E8ECF3] bg-slate-50/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-slate-900">
                        {record.companyName} / {record.jobName}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {record.interviewType} ·{' '}
                        {record.resumeMode === 'structured'
                          ? `结构化简历：${record.structuredResumeTitle || '未命名简历'}`
                          : `本地附件：${record.uploadedFileName || '未命名文件'}`}
                      </p>
                    </div>
                    <StatusBadge status={record.status} />
                  </div>
                  <p className="mt-3 text-xs text-slate-400">提交时间：{formatDate(record.createdAt)}</p>
                  {record.jobRequirement ? (
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">岗位JD：{record.jobRequirement}</p>
                  ) : null}
                  {record.status === 'failed' && record.errorMessage ? (
                    <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-600">{record.errorMessage}</p>
                  ) : null}
                  {record.status === 'completed' ? (
                    <div className="mt-4 flex items-center justify-end">
                      <Button type="button" variant="secondary" onClick={() => handleFileDownload(record)}>
                        <Download className="mr-2 h-4 w-4" />
                        下载逐字稿
                      </Button>
                    </div>
                  ) : null}
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-[#D8DEE8] px-4 py-10 text-center text-sm text-slate-500">
                暂无生成记录，提交表单后会在这里显示状态与下载入口。
              </div>
            )}
          </div>
        </aside>
      </section>

      {tipOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-lg rounded-[24px] bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
            <h3 className="text-lg font-semibold text-slate-900">温馨提示</h3>
            <p className="mt-4 text-sm leading-7 text-slate-600">{SUBMIT_SUCCESS_MESSAGE}</p>
            <div className="mt-6 flex justify-end">
              <Button type="button" onClick={() => setTipOpen(false)}>
                我知道了
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {promptDialog ? (
        <ActionDialog
          title={
            promptDialog.type === 'login-required'
              ? '登录后即可提交生成'
              : promptDialog.type === 'quota-exhausted'
                ? '免费生成次数已用尽'
                : '确认使用本次免费机会'
          }
          description={
            promptDialog.type === 'login-required'
              ? '面试辅导次数需要绑定到你的账号后才可扣减和返还。登录后可获得 1 次免费机会，开通超级会员可解锁 20 次使用机会。'
              : promptDialog.type === 'quota-exhausted'
                ? '你当前可用的面试辅导次数已用尽。继续使用请开通或续费超级会员，立即解锁 20 次使用机会。'
                : '你当前仅剩 1 次免费面试辅导机会。确认提交后会立即扣减；若生成失败系统会自动返还。开通超级会员可直接解锁 20 次使用机会。'
          }
          cancelText={promptDialog.type === 'first-free-confirm' ? '我再想想' : '关闭弹窗'}
          confirmText={promptDialog.type === 'login-required' ? '去登录' : promptDialog.type === 'quota-exhausted' ? '去开通会员' : '确认提交'}
          onClose={() => setPromptDialog(null)}
          onConfirm={() => {
            const dialog = promptDialog;
            setPromptDialog(null);
            if (dialog.type === 'login-required') {
              router.push(`/login?redirect=${encodeURIComponent('/interview-transcript')}`);
              return;
            }
            if (dialog.type === 'quota-exhausted') {
              router.push('/membership');
              return;
            }
            void submitTranscriptRequest();
          }}
        />
      ) : null}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function ModeCard({
  title,
  description,
  active,
  onClick,
}: {
  title: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-2xl border px-4 py-4 text-left transition',
        active ? 'border-brand bg-brand/5 shadow-[0_10px_24px_rgba(255,128,2,0.10)]' : 'border-[#E5EAF1] bg-white hover:border-brand/40',
      )}
    >
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
    </button>
  );
}

function StatusBadge({ status }: { status: RecordStatus }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
        status === 'processing' && 'bg-amber-50 text-amber-600',
        status === 'completed' && 'bg-emerald-50 text-emerald-600',
        status === 'failed' && 'bg-rose-50 text-rose-600',
      )}
    >
      {status === 'processing' ? '生成中' : status === 'completed' ? '已完成' : '失败'}
    </span>
  );
}

function ActionDialog({
  title,
  description,
  cancelText,
  confirmText,
  onClose,
  onConfirm,
}: {
  title: string;
  description: string;
  cancelText: string;
  confirmText: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 px-4">
      <div className="w-full max-w-lg rounded-[24px] bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-4 text-sm leading-7 text-slate-600">{description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            {cancelText}
          </Button>
          <Button type="button" onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
