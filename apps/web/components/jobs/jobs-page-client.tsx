'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Crown,
  Clock3,
  LayoutGrid,
  MapPin,
  RotateCcw,
  Rows3,
  Search,
  Star,
  Users,
} from 'lucide-react';
import { MemberAccessDialog } from '@/components/membership/member-access-dialog';
import { KeywordSuggestionDropdown, useKeywordSuggestions } from '@/components/common/keyword-suggestion-dropdown';
import { ProfileOnboardingModal } from '@/components/jobs/profile-onboarding-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { clientFetch } from '@/lib/api';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { showToast, useGlobalToast } from '@/store/toast-store';
import { AuthUser, JobFilters, JobItem, JobListResponse, JobSearchSuggestionItem, JobStats, MemberPermissionKey, ServiceItem } from '@/types';

interface Props {
  initialStats: JobStats;
  initialFilters: JobFilters;
  initialJobs: JobListResponse;
  serviceProducts: ServiceItem[];
}

type MultiValueFilterField = 'degreeRequirement' | 'enterpriseNature' | 'recruitmentType' | 'updatedWithinDays';
type FilterField = 'generalKeyword' | 'cityKeyword' | MultiValueFilterField;

interface FiltersState {
  generalKeyword: string;
  cityKeyword: string;
  degreeRequirement: string[];
  enterpriseNature: string[];
  recruitmentType: string[];
  updatedWithinDays: string[];
}

interface FilterTag {
  field: FilterField;
  value: string;
  label: string;
}

type DeliveryType = 'email' | 'website';

type ClipboardModalState = {
  title: string;
  value: string;
  description: string;
  confirmText: string;
  successMessage: string;
};

const initialFilterState: FiltersState = {
  generalKeyword: '',
  cityKeyword: '',
  degreeRequirement: [],
  enterpriseNature: [],
  recruitmentType: [],
  updatedWithinDays: [],
};

const clampStyle = (lines = 3): CSSProperties => ({
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
});

function HoverPreviewText({
  label,
  text,
  className,
  lines = 3,
}: {
  label: string;
  text?: string | null;
  className?: string;
  lines?: number;
}) {
  const content = text?.trim() || '-';

  return (
    <div className="group relative min-w-0">
      <p className={cn('break-words text-sm text-[#333333]', className)} style={clampStyle(lines)}>
        {content}
      </p>
      <div className="pointer-events-none absolute left-0 top-full z-30 mt-3 hidden w-[min(400px,85vw)] rounded-2xl border border-orange-100 bg-white p-4 text-sm opacity-0 shadow-2xl transition duration-150 md:block md:-translate-y-2 md:group-hover:translate-y-0 md:group-hover:opacity-100">
        <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#FF8002]">{label}</p>
        <p className="mt-2.5 whitespace-pre-line break-words leading-7 text-slate-700">{content}</p>
      </div>
    </div>
  );
}

const filterLabelClass = 'text-[12px] font-medium text-[#666666]';
const toolbarChipBase = 'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition';
const jobMetaTagBaseClass = 'inline-flex w-fit items-center rounded-md px-2.5 py-1 text-[11px] font-bold leading-none';
const membershipAvatarUrls = [
  'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_799b0e63-a9a9-4481-8b8a-f10954430c52.jpg',
  'https://miaoda-site-img.cdn.bcebos.com/images/305127fd-1137-4062-8ef7-fc6b919fbec9.jpg',
  'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_be63860f-4678-421e-b8fe-444d1a30dfea.jpg',
  'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_b33a01af-7327-45ad-b755-6cdc2c5ef07a.jpg',
  'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_36f35de0-9def-4b98-a52b-b844702b206a.jpg',
  'https://miaoda-site-img.cdn.bcebos.com/images/e386e94e-d633-462b-a12e-8018a59d9e90.jpg',
] as const;

function MultiSelectDropdown({
  label,
  placeholder,
  options,
  values,
  onToggle,
  onClear,
}: {
  label: string;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  values: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const selectedLabels = options.filter((option) => values.includes(option.value)).map((option) => option.label);
  const summaryText = !selectedLabels.length
    ? placeholder
    : selectedLabels.length <= 2
      ? selectedLabels.join('、')
      : `已选 ${selectedLabels.length} 项`;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (detailsRef.current && !detailsRef.current.contains(event.target as Node)) {
        detailsRef.current.removeAttribute('open');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <details ref={detailsRef} className="group relative [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex h-10 list-none items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm transition hover:border-orange-200">
        <div className="min-w-0 flex-1">
          <span className={cn('block truncate text-left', selectedLabels.length ? 'text-[#333333]' : 'text-slate-400')}>
            {summaryText}
          </span>
        </div>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180" />
      </summary>

      <div className="absolute left-0 top-full z-20 mt-2 w-full overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-[0_16px_32px_rgba(15,23,42,0.12)]">
        <div className="max-h-56 overflow-y-auto p-2">
          {options.length ? options.map((option) => {
            const checked = values.includes(option.value);

            return (
              <label
                key={option.value}
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm transition',
                  checked ? 'bg-orange-50 text-[#FF8002]' : 'text-[#333333] hover:bg-slate-50',
                )}
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                    checked ? 'border-[#FF8002] bg-[#FF8002] text-white' : 'border-slate-200 bg-white text-transparent',
                  )}
                >
                  <Check className="h-3.5 w-3.5" />
                </span>
                <input type="checkbox" checked={checked} onChange={() => onToggle(option.value)} className="sr-only" />
              </label>
            );
          }) : (
            <div className="px-3 py-6 text-center text-sm text-slate-400">暂无可选{label}</div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
          <span>{values.length ? `已选 ${values.length} 项` : '未选择'}</span>
          <button type="button" onClick={onClear} className="font-medium text-[#FF8002] transition hover:text-[#E67200]">
            清空
          </button>
        </div>
      </div>
    </details>
  );
}

function isUpdatedToday(value?: string | Date | null) {
  if (!value || value === '-') return false;
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function isDeadlineSoon(value?: string | Date | null, days = 7) {
  if (!value || value === '-') return false;
  const target = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(target.getTime())) {
    return false;
  }
  const now = new Date();
  const diff = target.getTime() - now.getTime();

  return diff > 0 && diff < days * 24 * 60 * 60 * 1000;
}

function getEnterpriseBadgeClass(nature?: string | null) {
  if (!nature) return 'bg-slate-100 text-slate-600';
  if (nature.includes('央')) return 'bg-violet-50 text-violet-600';
  if (nature.includes('国')) return 'bg-red-50 text-red-500';
  if (nature.includes('事业')) return 'bg-blue-50 text-blue-600';
  if (nature.includes('外')) return 'bg-cyan-50 text-cyan-600';
  return 'bg-emerald-50 text-emerald-600';
}

function resolveDeliveryType(value?: string | null): DeliveryType | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  return normalized.includes('@') && !/^https?:\/\//i.test(normalized) ? 'email' : 'website';
}

function getDisplayUpdateDate(job: JobItem) {
  return job.entryDate || job.updatedAt;
}

function getDisplayCompanyFullName(job: JobItem) {
  return job.companyFullName?.trim() || job.companyName?.trim() || '暂无企业名称';
}

function getDisplayJobName(job: JobItem) {
  return job.jobName?.trim() || '暂无岗位名称';
}

function getDisplayMajorRequirement(job: JobItem) {
  return job.majorRequirement?.trim() || '暂无专业需求';
}

function MembershipPromoCard({ onUpgrade, user }: { onUpgrade: () => void; user: AuthUser | null }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % membershipAvatarUrls.length);
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  // 展示逻辑：
  // 1. 未登录用户：展示
  // 2. 已登录非会员：展示
  // 3. 已登录会员且剩余天数 < 10：展示
  // 4. 已登录会员且剩余天数 >= 10：不展示
  const shouldShow = useMemo(() => {
    if (!user) return true;
    if (!user.isMember) return true;
    const remainingDays = user.membershipRemainingDays ?? 0;
    return remainingDays < 10;
  }, [user]);

  if (!shouldShow) {
    return null;
  }

  const currentAvatars = [
    membershipAvatarUrls[currentIndex % membershipAvatarUrls.length],
    membershipAvatarUrls[(currentIndex + 1) % membershipAvatarUrls.length],
    membershipAvatarUrls[(currentIndex + 2) % membershipAvatarUrls.length],
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scan-light {
          0% { left: -100%; }
          100% { left: 200%; }
        }
        .animate-scan-light {
          animation: scan-light 2s infinite linear;
        }
      `}} />
      <section className="relative mx-auto h-auto min-h-[100px] w-full max-w-[1400px] overflow-hidden rounded-xl border-2 border-[#D4AF37] bg-[#0A0909] text-white md:h-[140px]">
        {/* 扫描光效 */}
        <div className="pointer-events-none absolute inset-0 z-0">
          <div className="animate-scan-light absolute inset-0 -left-full w-full skew-x-[-25deg] bg-gradient-to-r from-transparent via-[#D4AF37]/15 to-transparent" />
        </div>

        <div className="relative z-10 flex h-full items-center px-4 md:px-8">
          {/* 左侧容器：比例 0.9 */}
          <div className="flex-[0.9] flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-2 md:gap-3">
              <Crown className="h-6 w-6 shrink-0 text-[#D4AF37] md:h-8 md:w-8" />
              <h2 className="whitespace-nowrap text-sm font-bold md:text-lg">开通会员 解锁全部功能</h2>
            </div>
            <div
              className="mt-1 text-base font-bold text-[#D4AF37] md:mt-2 md:text-xl"
              style={{ textShadow: '0 0 8px rgba(212, 175, 55, 0.5)' }}
            >
              每天不到5毛钱
            </div>
          </div>

          {/* 中间容器：比例 1.4（PC显示，H5隐藏） */}
          <div className="hidden flex-[1.4] px-4 md:grid md:grid-cols-2 md:gap-x-6 md:gap-y-2 lg:gap-x-8 lg:gap-y-3">
            <div className="min-w-0">
              <p className="whitespace-nowrap text-xs font-medium text-[#D4AF37] lg:text-sm">无限投递：</p>
              <p className="truncate text-[10px] text-gray-300 lg:text-xs">不限次数投递心仪岗位</p>
            </div>
            <div className="min-w-0">
              <p className="whitespace-nowrap text-xs font-medium text-[#D4AF37] lg:text-sm">校招求职资料包：</p>
              <p className="truncate text-[10px] text-gray-300 lg:text-xs">面试常见问题回答技巧、优秀简历模版</p>
            </div>
            <div className="min-w-0">
              <p className="whitespace-nowrap text-xs font-medium text-[#D4AF37] lg:text-sm">专属推荐：</p>
              <p className="truncate text-[10px] text-gray-300 lg:text-xs">根据个人求职意向专属推荐相关岗位</p>
            </div>
            <div className="min-w-0">
              <p className="whitespace-nowrap text-xs font-medium text-[#D4AF37] lg:text-sm">求职辅导课：</p>
              <p className="truncate text-[10px] text-gray-300 lg:text-xs">加入校招求职群，定期分享名师求职辅导课</p>
            </div>
          </div>

          {/* 右侧容器：比例 0.7 */}
          <div className="flex-[0.7] flex flex-col items-center justify-center">
            <div className="mb-1 flex -space-x-1.5 md:mb-2 md:-space-x-2">
              {currentAvatars.map((url, idx) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={`${url}-${idx}`}
                  src={url}
                  alt="用户头像"
                  className="h-6 w-6 shrink-0 rounded-full border border-black object-cover md:h-7 md:w-7"
                />
              ))}
            </div>
            <p className="mb-1 whitespace-nowrap text-[10px] text-gray-300 md:mb-2 md:text-xs">
              已有<span className="font-bold text-[#D4AF37]">2,358</span>人开通
            </p>
            <button
              type="button"
              onClick={onUpgrade}
              className="inline-flex h-8 items-center justify-center rounded-lg bg-gradient-to-r from-[#B08D29] to-[#D4AF37] px-4 text-xs font-bold text-black shadow-[0_0_15px_rgba(212,175,55,0.6)] transition hover:from-[#C29E2E] hover:to-[#E6C35C] md:h-10 md:px-6 md:text-base"
            >
              立即开通
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

function ActionGrid({
  job,
  onViewAnnouncement,
  onDeliver,
  onProgress,
  onReferral,
  progressOptions,
}: {
  job: JobItem;
  onViewAnnouncement: (job: JobItem) => void;
  onDeliver: (job: JobItem) => void;
  onProgress: (jobId: string, status: string) => void;
  onReferral: (jobId: string) => void;
  progressOptions: string[];
}) {
  const deliveryType = resolveDeliveryType(job.deliveryUrl) ?? job.deliveryType ?? null;

  return (
    <div className="grid grid-cols-2 gap-1.5">
      <Button className="h-8 w-full bg-[#FF8002] px-1.5 text-[11px] hover:bg-[#E67200]" onClick={() => onViewAnnouncement(job)}>
        查看公告
      </Button>
      <Button className="h-8 w-full bg-[#FF8002] px-1.5 text-[11px] hover:bg-[#E67200]" onClick={() => onDeliver(job)}>
        {deliveryType === 'email' ? '查看邮箱' : '立即投递'}
      </Button>
      <Select
        className="h-8 w-full rounded-lg border-slate-200 bg-white text-center text-[11px]"
        value={job.currentProgress === '未标记' ? '' : job.currentProgress}
        onChange={(e) => e.target.value && onProgress(job.id, e.target.value)}
      >
        <option value="">求职进度</option>
        {progressOptions.filter((item) => item !== '全部').map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
      {job.hasReferral ? (
        <Button className="h-8 w-full bg-[#FF8002] px-1.5 text-[11px] hover:bg-[#E67200]" onClick={() => onReferral(job.id)}>
          查看内推码
        </Button>
      ) : (
        <div className="h-8 w-full" aria-hidden="true" />
      )}
    </div>
  );
}

/**
 * H5移动端专用：4个按钮横向1行排列，无内推码时显示占位保持布局
 */
function MobileActionGrid({
  job,
  onViewAnnouncement,
  onDeliver,
  onProgress,
  onReferral,
  progressOptions,
}: {
  job: JobItem;
  onViewAnnouncement: (job: JobItem) => void;
  onDeliver: (job: JobItem) => void;
  onProgress: (jobId: string, status: string) => void;
  onReferral: (jobId: string) => void;
  progressOptions: string[];
}) {
  const deliveryType = resolveDeliveryType(job.deliveryUrl) ?? job.deliveryType ?? null;

  return (
    <div className="grid grid-cols-4 gap-1.5">
      <Button className="h-9 w-full bg-[#FF8002] px-0.5 text-[10px] hover:bg-[#E67200]" onClick={() => onViewAnnouncement(job)}>
        公告
      </Button>
      <Button className="h-9 w-full bg-[#FF8002] px-0.5 text-[10px] hover:bg-[#E67200]" onClick={() => onDeliver(job)}>
        {deliveryType === 'email' ? '邮箱' : '投递'}
      </Button>
      <Select
        className="h-9 w-full rounded-lg border-slate-200 bg-white text-center text-[10px]"
        value={job.currentProgress === '未标记' ? '' : job.currentProgress}
        onChange={(e) => e.target.value && onProgress(job.id, e.target.value)}
      >
        <option value="">进度</option>
        {progressOptions.filter((item) => item !== '全部').map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
      {job.hasReferral ? (
        <Button className="h-9 w-full bg-[#FF8002] px-0.5 text-[10px] hover:bg-[#E67200]" onClick={() => onReferral(job.id)}>
          内推码
        </Button>
      ) : (
        <div className="h-9 w-full" aria-hidden="true" />
      )}
    </div>
  );
}

function JobRow({
  job,
  mounted,
  onViewAnnouncement,
  onDeliver,
  onProgress,
  onReferral,
  progressOptions,
}: {
  job: JobItem;
  mounted: boolean;
  onViewAnnouncement: (job: JobItem) => void;
  onDeliver: (job: JobItem) => void;
  onProgress: (jobId: string, status: string) => void;
  onReferral: (jobId: string) => void;
  progressOptions: string[];
}) {
  const updatedToday = mounted && isUpdatedToday(getDisplayUpdateDate(job));
  const deadlineSoon = mounted && isDeadlineSoon(job.deadlineAt);

  return (
    <div className="relative grid gap-3 border-b border-[#F3F4F6] px-4 py-4 text-sm transition hover:bg-[#FFF7ED] last:border-b-0 md:grid-cols-[88px_1.02fr_0.6fr_1.15fr_1.5fr_1.5fr_104px_160px] md:items-center md:gap-4 before:absolute before:left-0 before:top-0 before:h-full before:w-1.5 before:rounded-r before:bg-[#FF8002]">
      <div className="min-w-0">
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF] md:hidden">更新日期</p>
        <div className="flex flex-col gap-1.5">
          <span className="font-semibold text-[#333333]">{formatDate(getDisplayUpdateDate(job))}</span>
          {updatedToday ? <span className="inline-flex w-fit rounded-md bg-orange-100 px-2.5 py-1 text-[12px] font-bold leading-none text-[#FF8002]">最新</span> : null}
        </div>
      </div>

      <div className="min-w-0">
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF] md:hidden">企业全称</p>
        <div className="flex flex-col gap-2">
          <HoverPreviewText label="企业全称" text={getDisplayCompanyFullName(job)} className="font-bold text-sm" lines={2} />
          {job.enterpriseNature ? (
            <span className={cn(jobMetaTagBaseClass, 'text-[12px] px-3 py-1', getEnterpriseBadgeClass(job.enterpriseNature))}>{job.enterpriseNature}</span>
          ) : null}
        </div>
      </div>

      <div className="min-w-0">
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF] md:hidden">招聘要求</p>
        <div className="flex flex-col gap-2">
          {job.degreeRequirement ? <span className={cn(jobMetaTagBaseClass, 'bg-orange-100 text-[#FF8002] text-[12px] px-3 py-1')}>{job.degreeRequirement}</span> : null}
          {job.recruitmentType ? <span className={cn(jobMetaTagBaseClass, 'bg-blue-50 text-blue-600 text-[12px] px-3 py-1')}>{job.recruitmentType}</span> : null}
        </div>
      </div>

      <div className="min-w-0">
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF] md:hidden">招聘地区</p>
        <div className="inline-flex items-start gap-1.5 text-sm text-[#666666]">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#FF8002]" />
          <HoverPreviewText label="招聘地区" text={job.workLocation} className="text-sm text-[#666666]" lines={3} />
        </div>
      </div>

      <div className="min-w-0">
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF] md:hidden">招聘岗位</p>
        <HoverPreviewText label="招聘岗位" text={getDisplayJobName(job)} className="font-bold text-sm text-[#333333]" lines={4} />
      </div>

      <div className="min-w-0">
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF] md:hidden">专业需求</p>
        <HoverPreviewText label="专业需求" text={getDisplayMajorRequirement(job)} className="text-sm text-[#666666]" lines={4} />
      </div>

      <div className="min-w-0">
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF] md:hidden">截止日期</p>
        <div className="flex flex-col gap-1.5 text-[13px] text-[#666666]">
          <p className="font-semibold text-[#333333]">{formatDate(job.deadlineAt)}</p>
          {deadlineSoon ? <span className="inline-flex w-fit rounded-md bg-rose-50 px-2.5 py-1 text-[12px] font-bold leading-none text-rose-500">即将截止</span> : null}
        </div>
      </div>

      <div className="min-w-0">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[#9CA3AF] md:hidden">会员操作区</p>
        <ActionGrid
          job={job}
          onViewAnnouncement={onViewAnnouncement}
          onDeliver={onDeliver}
          onProgress={onProgress}
          onReferral={onReferral}
          progressOptions={progressOptions}
        />
      </div>
    </div>
  );
}

export function JobsPageClient({ initialStats, initialFilters, initialJobs, serviceProducts }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const { token, user } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [filters, setFilters] = useState<FiltersState>(initialFilterState);
  const [tab, setTab] = useState<'all' | 'recommended'>('all');
  const [view, setView] = useState<'list' | 'card'>('card');
  const [jobs, setJobs] = useState<JobItem[]>(initialJobs.list);
  const [pagination, setPagination] = useState(initialJobs.pagination);
  const [recommendedFeed, setRecommendedFeed] = useState<JobListResponse['recommendedFeed']>(initialJobs.recommendedFeed);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [activeClipboardModal, setActiveClipboardModal] = useState<ClipboardModalState | null>(null);
  const [copyingClipboardValue, setCopyingClipboardValue] = useState(false);
  const [memberAccessMessage, setMemberAccessMessage] = useState('');
  const [generalSuggestionOpen, setGeneralSuggestionOpen] = useState(false);
  const [citySuggestionOpen, setCitySuggestionOpen] = useState(false);

  // 用于追踪上一次应用到 API 的过滤条件，避免重复请求和无限循环
  const lastAppliedRef = useRef<{ filters: string; tab: string }>({
    filters: JSON.stringify(initialFilterState),
    tab: 'all',
  });
  const isFirstRender = useRef(true);

  useGlobalToast(message, setMessage);
  const generalKeywordSuggestions = useKeywordSuggestions({
    keyword: filters.generalKeyword,
    field: 'general',
    token,
    enabled: generalSuggestionOpen,
  });
  const cityKeywordSuggestions = useKeywordSuggestions({
    keyword: filters.cityKeyword,
    field: 'location',
    token,
    enabled: citySuggestionOpen,
  });

  const progressOptions = useMemo(() => ['全部', '已投递', '已笔试', '已面试', '已录用', '已拒绝', '已取消', '其他'], []);

  const totalCount = pagination.total || jobs.length;
  const updatedWithinDayOptions = useMemo(
    () => [
      { value: '1', label: '最近 1 天' },
      { value: '3', label: '最近 3 天' },
      { value: '7', label: '最近 1 周' },
      { value: '30', label: '最近 1 个月' },
    ],
    [],
  );
  const updatedWithinDayLabelMap = useMemo(
    () => new Map(updatedWithinDayOptions.map((item) => [item.value, item.label])),
    [updatedWithinDayOptions],
  );
  const advancedFilterOptions = useMemo<Record<MultiValueFilterField, Array<{ value: string; label: string }>>>(
    () => ({
      degreeRequirement: initialFilters.degreeOptions.map((item) => ({ value: item, label: item })),
      enterpriseNature: initialFilters.enterpriseNatureOptions.map((item) => ({ value: item, label: item })),
      recruitmentType: (initialFilters.recruitmentTypeOptions ?? initialFilters.jobTypeOptions ?? []).map((item) => ({ value: item, label: item })),
      updatedWithinDays: updatedWithinDayOptions,
    }),
    [initialFilters.degreeOptions, initialFilters.enterpriseNatureOptions, initialFilters.recruitmentTypeOptions, initialFilters.jobTypeOptions, updatedWithinDayOptions],
  );
  const statItems = useMemo(
    () => [
      { label: '3天内', value: initialStats.threeDays, icon: Clock3 },
      { label: '7天内', value: initialStats.sevenDays, icon: CalendarDays },
      { label: '30天内', value: initialStats.thirtyDays, icon: CalendarDays },
      { label: '累计总数', value: initialStats.total, icon: BarChart3 },
    ],
    [initialStats],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setView('card');
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (searchParams.get('tab') !== 'recommended') {
      return;
    }
    if (!token || tab === 'recommended') {
      return;
    }
    if (!user?.permissionKeys?.includes('jobs:recommend:view')) {
      return;
    }
    void handleTabChange('recommended');
  }, [searchParams, tab, token, user?.permissionKeys]); // eslint-disable-line react-hooks/exhaustive-deps

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!loaderRef.current || !pagination.hasMore) return;
    const element = loaderRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !loading) {
          void fetchJobs(pagination.page + 1, true);
        }
      },
      { rootMargin: '120px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [pagination, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // 全自动即时检索逻辑
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      // 初始数据已由 props 提供，同步初始状态到 ref
      lastAppliedRef.current = { filters: JSON.stringify(filters), tab };
      return;
    }

    const currentFiltersStr = JSON.stringify(filters);
    // 如果过滤条件和 Tab 都没有变化（或者是被手动点击搜索/重置触发的更新），则跳过
    if (currentFiltersStr === lastAppliedRef.current.filters && tab === lastAppliedRef.current.tab) {
      return;
    }

    // 计算延迟：如果涉及关键字输入则应用较长防抖，如果仅是下拉框勾选则快速响应
    const prevFilters = JSON.parse(lastAppliedRef.current.filters) as FiltersState;
    const isKeywordChanged =
      filters.generalKeyword !== prevFilters.generalKeyword ||
      filters.cityKeyword !== prevFilters.cityKeyword;

    const delay = isKeywordChanged ? 500 : 150;

    const timer = setTimeout(() => {
      // 再次确认状态未过期
      if (JSON.stringify(filters) === currentFiltersStr && tab === lastAppliedRef.current.tab) {
        void applyFilterRequest(filters, tab, { keepScrollPosition: false });
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [filters, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const buildQuery = (page: number, nextFilters: FiltersState = filters, includeTrackingUserId = true) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '20');
    if (includeTrackingUserId && user?.id) params.set('userId', user.id);
    if (nextFilters.generalKeyword.trim()) {
      params.set('keyword', nextFilters.generalKeyword.trim());
    }
    if (nextFilters.cityKeyword.trim()) {
      params.set('cityKeyword', nextFilters.cityKeyword.trim());
    }
    nextFilters.degreeRequirement.forEach((value) => params.append('degreeRequirement', value));
    nextFilters.enterpriseNature.forEach((value) => params.append('enterpriseNature', value));
    nextFilters.recruitmentType.forEach((value) => params.append('recruitmentType', value));
    nextFilters.updatedWithinDays.forEach((value) => params.append('updatedWithinDays', value));
    return params.toString();
  };

  const fetchJobs = async (
    page: number,
    append = false,
    nextFilters: FiltersState = filters,
    nextTab: 'all' | 'recommended' = tab,
  ) => {
    setLoading(true);
    try {
      const path = nextTab === 'recommended'
        ? `/jobs/recommended?${buildQuery(page, nextFilters, false)}`
        : `/jobs?${buildQuery(page, nextFilters, true)}`;
      const result = await clientFetch<JobListResponse>(path, undefined, token || undefined);
      setJobs((prev) => (append ? [...prev, ...result.list] : result.list));
      setPagination(result.pagination);
      setRecommendedFeed(nextTab === 'recommended' ? result.recommendedFeed : undefined);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '岗位加载失败');
    } finally {
      setLoading(false);
    }
  };

  const hasKeywordFilters = (nextFilters: FiltersState) => Boolean(nextFilters.generalKeyword.trim() || nextFilters.cityKeyword.trim());

  const hasAdvancedFilters = (nextFilters: FiltersState) => Boolean(
    nextFilters.degreeRequirement.length
    || nextFilters.enterpriseNature.length
    || nextFilters.recruitmentType.length
    || nextFilters.updatedWithinDays.length,
  );

  const getAdvancedFilterCount = (nextFilters: FiltersState) => (
    nextFilters.degreeRequirement.length
    + nextFilters.enterpriseNature.length
    + nextFilters.recruitmentType.length
    + nextFilters.updatedWithinDays.length
  );

  const requireLogin = (targetTab: 'all' | 'recommended' = tab) => {
    showToast('请先登录后再进行该操作');
    const redirectQuery = targetTab === 'recommended' ? '?tab=recommended' : '';
    router.push(`/login?redirect=${encodeURIComponent(`/jobs${redirectQuery}`)}`);
  };

  const hasPermission = (permissionKey: MemberPermissionKey) => Boolean(user?.permissionKeys?.includes(permissionKey));

  const requireMemberPermission = (
    permissionKey: MemberPermissionKey,
    messageText: string,
    options?: { targetTab?: 'all' | 'recommended' },
  ) => {
    if (!token) {
      requireLogin(options?.targetTab ?? tab);
      return false;
    }
    if (hasPermission(permissionKey)) {
      return true;
    }
    setMemberAccessMessage(messageText);
    return false;
  };

  const applyFilterRequest = async (
    nextFilters: FiltersState,
    nextTab: 'all' | 'recommended' = tab,
    options?: { keepScrollPosition?: boolean; resetToAllTab?: boolean; successMessage?: string },
  ) => {
    const targetTab = options?.resetToAllTab ? 'all' : nextTab;

    if (hasKeywordFilters(nextFilters) && !requireMemberPermission('jobs:search:use', '标准会员及以上可使用岗位搜索功能', { targetTab })) {
      return false;
    }
    if (hasAdvancedFilters(nextFilters) && !requireMemberPermission('jobs:filter:use', '标准会员及以上可使用岗位筛选功能', { targetTab })) {
      return false;
    }

    setFilters(nextFilters);
    if (options?.resetToAllTab) {
      setTab('all');
      setRecommendedFeed(undefined);
    }

    // 同步更新 Ref，告知自动检索逻辑该状态已应用，无需重复触发
    lastAppliedRef.current = {
      filters: JSON.stringify(nextFilters),
      tab: targetTab,
    };

    if (options?.successMessage) {
      setMessage(options.successMessage);
    }
    if (!options?.keepScrollPosition && typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    await fetchJobs(1, false, nextFilters, targetTab);
    return true;
  };

  const runSearch = async () => {
    await applyFilterRequest(filters);
  };

  const resetFilters = async () => {
    const nextFilters = initialFilterState;
    setFiltersExpanded(false);
    await applyFilterRequest(nextFilters, 'all', {
      resetToAllTab: true,
      successMessage: '已重置筛选条件',
    });
  };

  const toggleMultiFilterValue = (field: MultiValueFilterField, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((item) => item !== value)
        : [...prev[field], value],
    }));
  };

  const removeFilterTag = async (tag: FilterTag) => {
    const nextFilters = tag.field === 'generalKeyword' || tag.field === 'cityKeyword'
      ? { ...filters, [tag.field]: '' }
      : { ...filters, [tag.field]: filters[tag.field].filter((item) => item !== tag.value) };

    await applyFilterRequest(nextFilters, tab, { keepScrollPosition: true });
  };

  const handleTabChange = async (nextTab: 'all' | 'recommended') => {
    if (nextTab === 'recommended' && !requireMemberPermission('jobs:recommend:view', '专属推荐仅对超级会员开放，请先开通或升级会员', { targetTab: 'recommended' })) {
      return;
    }

    const nextFilters = initialFilterState;
    setFiltersExpanded(false);
    setTab(nextTab);
    setFilters(nextFilters);

    // 同步更新 Ref
    lastAppliedRef.current = {
      filters: JSON.stringify(nextFilters),
      tab: nextTab,
    };

    await fetchJobs(1, false, nextFilters, nextTab);
  };

  const closeClipboardModal = () => {
    if (copyingClipboardValue) {
      return;
    }
    setActiveClipboardModal(null);
  };

  const fallbackCopyTextToClipboard = (text: string): boolean => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch {
      document.body.removeChild(textArea);
      return false;
    }
  };

  const copyClipboardModalValue = async () => {
    if (!activeClipboardModal?.value) {
      return;
    }

    try {
      setCopyingClipboardValue(true);
      let success = false;

      // 优先使用现代 Clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(activeClipboardModal.value);
        success = true;
      } else {
        // 降级使用 execCommand
        success = fallbackCopyTextToClipboard(activeClipboardModal.value);
      }

      if (success) {
        setMessage(activeClipboardModal.successMessage);
        setActiveClipboardModal(null);
      } else {
        setMessage('复制失败，请手动复制');
      }
    } catch {
      // 异常时再次尝试降级方案
      const success = fallbackCopyTextToClipboard(activeClipboardModal.value);
      if (success) {
        setMessage(activeClipboardModal.successMessage);
        setActiveClipboardModal(null);
      } else {
        setMessage('复制失败，请手动复制');
      }
    } finally {
      setCopyingClipboardValue(false);
    }
  };

  const handleViewAnnouncement = (job: JobItem) => {
    if (!requireMemberPermission('jobs:detail:view', '标准会员及以上可查看招聘公告详情', { targetTab: tab })) {
      return;
    }
    if (!job.announcementUrl) {
      setMessage('当前岗位暂无公告链接');
      return;
    }

    try {
      void clientFetch(`/jobs/${job.id}/click`, { method: 'POST', body: JSON.stringify({ actionType: 'view_announcement' }) }, token || undefined);
    } catch {
      // 埋点失败时不阻断用户查看公告
    }

    window.open(job.announcementUrl, '_blank');
  };

  const handleDeliver = async (job: JobItem) => {
    if (!requireMemberPermission('jobs:deliver:use', '标准会员及以上可使用立即投递')) return;
    try {
      const result = await clientFetch<{
        action: string;
        deliveryType?: DeliveryType | null;
        deliveryUrl?: string | null;
        recruitmentType?: string | null;
        recruitmentLink?: string | null;
        progressStatus: string;
      }>(
        `/jobs/${job.id}/deliver`,
        { method: 'POST' },
        token!,
      );
      if (tab === 'recommended') {
        await fetchJobs(1, false, filters, 'recommended');
      } else {
        setJobs((prev) => prev.map((item) => (item.id === job.id ? { ...item, currentProgress: '已投递' } : item)));
      }

      const deliveryValue = result.deliveryUrl ?? result.recruitmentLink ?? job.deliveryUrl ?? null;
      const deliveryType = result.deliveryType ?? resolveDeliveryType(deliveryValue) ?? job.deliveryType ?? null;

      if (deliveryType === 'email' && deliveryValue) {
        setActiveClipboardModal({
          title: '查看邮箱',
          value: deliveryValue,
          description: '请复制该邮箱后，通过邮件发送简历进行投递。',
          confirmText: '复制该邮箱',
          successMessage: '邮箱已复制，快去发送简历吧',
        });
        return;
      }

      if (deliveryValue) {
        window.open(deliveryValue, '_blank');
        setMessage('已为你打开投递链接');
      } else {
        setMessage('当前岗位暂无投递入口');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '投递失败');
    }
  };

  const handleProgress = async (jobId: string, progressStatus: string) => {
    if (!requireMemberPermission('jobs:progress:update', '超级会员可标记求职进度')) return;
    try {
      await clientFetch(`/jobs/${jobId}/progress`, { method: 'PUT', body: JSON.stringify({ progressStatus }) }, token!);
      if (tab === 'recommended') {
        await fetchJobs(1, false, filters, 'recommended');
      } else {
        setJobs((prev) => prev.map((item) => (item.id === jobId ? { ...item, currentProgress: progressStatus } : item)));
      }
      setMessage('进度已保存');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
    }
  };

  const handleReferral = async (jobId: string) => {
    if (!requireMemberPermission('jobs:referral:view', '超级会员可查看岗位内推信息')) return;
    try {
      const result = await clientFetch<{ hasReferral: boolean; referralCode?: string | null; contactHint: string }>(`/jobs/${jobId}/referral`, {}, token!);
      if (result.referralCode?.trim()) {
        setActiveClipboardModal({
          title: '查看内推码',
          value: result.referralCode.trim(),
          description: '复制内推码后，可在企业投递入口或内推流程中使用。',
          confirmText: '复制内推码',
          successMessage: '内推码已复制',
        });
        return;
      }
      setMessage(result.contactHint);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '查看内推失败');
    }
  };

  const applyKeywordSuggestion = (field: 'generalKeyword' | 'cityKeyword', item: JobSearchSuggestionItem) => {
    setFilters((prev) => ({ ...prev, [field]: item.value }));
    if (field === 'generalKeyword') {
      setGeneralSuggestionOpen(false);
      return;
    }
    setCitySuggestionOpen(false);
  };

  const selectedFilterTags = useMemo<FilterTag[]>(() => {
    const tags: FilterTag[] = [];

    if (filters.generalKeyword.trim()) {
      tags.push({ field: 'generalKeyword', value: filters.generalKeyword.trim(), label: filters.generalKeyword.trim() });
    }
    if (filters.cityKeyword.trim()) {
      tags.push({ field: 'cityKeyword', value: filters.cityKeyword.trim(), label: filters.cityKeyword.trim() });
    }

    filters.degreeRequirement.forEach((value) => {
      tags.push({ field: 'degreeRequirement', value, label: value });
    });
    filters.enterpriseNature.forEach((value) => {
      tags.push({ field: 'enterpriseNature', value, label: value });
    });
    filters.recruitmentType.forEach((value) => {
      tags.push({ field: 'recruitmentType', value, label: value });
    });
    filters.updatedWithinDays.forEach((value) => {
      tags.push({
        field: 'updatedWithinDays',
        value,
        label: updatedWithinDayLabelMap.get(value) ?? value,
      });
    });

    return tags;
  }, [filters, updatedWithinDayLabelMap]);

  const renderFilterTagRow = () => {
    if (!selectedFilterTags.length) {
      return null;
    }

    return (
      <div className="mt-4 border-t border-[#F3F4F6] pt-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs leading-5 text-slate-500">已选条件共 {selectedFilterTags.length} 项，可点击单个标签快速取消</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedFilterTags.map((tag) => (
            <button
              key={`${tag.field}-${tag.value}`}
              type="button"
              onClick={() => void removeFilterTag(tag)}
              className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-[#FF8002] transition hover:border-orange-300 hover:bg-orange-100"
            >
              <span>{tag.label}</span>
              <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const getRecommendedEmptyText = () => {
    if (recommendedFeed?.stateCode === 'PREFERENCE_REQUIRED') {
      return recommendedFeed.stateMessage || '完善求职意向后，即可查看专属推荐。';
    }
    if (recommendedFeed?.stateCode === 'NO_MATCHED_RESULT') {
      return recommendedFeed.stateMessage || '暂无匹配岗位，可调整意向条件后重试。';
    }
    return '当前暂无符合时效条件的推荐岗位，请稍后再来查看；完善求职意向后，推荐会更精准。';
  };

  const renderRecommendedFeedNotice = () => {
    if (tab !== 'recommended' || !recommendedFeed) {
      return null;
    }

    if (recommendedFeed.stateCode === 'PREFERENCE_REQUIRED') {
      return (
        <div className="mx-3 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 sm:mx-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">{recommendedFeed.stateMessage || '完善求职意向后，即可查看专属推荐'}</p>
              {recommendedFeed.summaryText ? <p className="mt-1 text-xs leading-6 text-amber-700">{recommendedFeed.summaryText}</p> : null}
            </div>
            <Button className="bg-[#FF8002] hover:bg-[#E67200]" onClick={() => router.push('/personal-center')}>
              去完善意向
            </Button>
          </div>
        </div>
      );
    }

    if (recommendedFeed.stateCode === 'NO_MATCHED_RESULT') {
      return (
        <div className="mx-3 mt-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800 sm:mx-4">
          <p className="font-semibold">{recommendedFeed.stateMessage || '暂无匹配岗位，可调整意向条件后重试'}</p>
          {recommendedFeed.summaryText ? <p className="mt-1 text-xs leading-6 text-orange-700">{recommendedFeed.summaryText}</p> : null}
        </div>
      );
    }

    if (!recommendedFeed.summaryText) {
      return null;
    }

    return (
      <div className="mx-3 mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 sm:mx-4">
        <p className="font-medium">{recommendedFeed.summaryText}</p>
      </div>
    );
  };

  const renderServiceModule = (mode: 'desktop' | 'mobile') => (
    <Card className={cn('overflow-hidden rounded-xl border-0 shadow-[0_1px_3px_rgba(0,0,0,0.1)]', mode === 'desktop' ? 'h-fit' : '')}>
      <div className="bg-[#FF8002] px-4 py-3 text-center text-white">
        <h3 className="text-base font-bold">热门求职服务</h3>
        <p className="mt-1 text-xs text-white/90">咨询客服有优惠</p>
      </div>
      <div className={cn(mode === 'desktop' ? 'flex min-h-[420px] flex-col gap-2.5 p-2.5' : 'mt-0 flex gap-2.5 overflow-x-auto p-3')}>
        {serviceProducts.map((item) => (
          <div
            key={item.id}
            className={cn(
              'flex flex-col gap-2.5 rounded-xl border border-slate-100 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.06)]',
              mode === 'desktop' ? '' : 'min-w-[250px] shadow-sm',
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-[#333333]">{item.name}</h4>
              {item.isHot ? <Badge className="bg-orange-100 text-[#FF8002]">热销</Badge> : null}
            </div>
            <p className="text-xs leading-5 text-[#666666]" style={clampStyle(2)}>
              {item.description}
            </p>
            <div className="flex items-center justify-between gap-3 text-xs text-[#666666]">
              <div className="flex items-baseline gap-1">
                <span className="text-base font-bold text-[#FF8002]">{formatCurrency(item.price)}</span>
                <span className="text-[#9CA3AF] line-through">{formatCurrency(item.originalPrice)}</span>
              </div>
              <span>★ {item.score}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-xs text-[#9CA3AF]">
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {item.salesCount}人已购
              </span>
              <Button className="h-8 bg-[#FF8002] px-3 text-xs hover:bg-[#E67200]" onClick={() => window.open(`/services/${item.id}`, '_blank')}>
                查看详情
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );

  return (
    <>
      <ProfileOnboardingModal token={token} />
      <main className="mx-auto w-full px-3 py-4 sm:px-4 lg:px-6 lg:py-6 xl:w-[90vw] xl:max-w-none">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,8.5fr)_minmax(220px,1.5fr)] xl:items-start">
        <div className="min-w-0 space-y-4">
          <section className="grid grid-cols-4 gap-2 min-w-0 md:gap-3">
            {statItems.map((item) => {
              const Icon = item.icon;
              return (
                <Card
                  key={item.label}
                  className="min-w-0 rounded-xl border-0 px-2 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.1)] transition hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] md:px-3 md:py-3"
                >
                  <div className="flex min-h-[72px] items-center justify-center md:min-h-[84px]">
                    <div className="flex min-w-0 flex-col items-center justify-center gap-1.5 text-center md:flex-row md:gap-3.5 md:text-left">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-[#FF8002] md:h-10 md:w-10 md:rounded-xl lg:h-11 lg:w-11">
                        <Icon className="h-[14px] w-[14px] md:h-[18px] md:w-[18px] lg:h-5 lg:w-5" />
                      </div>
                      <div className="flex min-w-0 flex-col justify-center">
                        <p className="truncate text-[9px] font-medium leading-tight text-[#666666] md:text-[11px] lg:text-xs">{item.label}</p>
                        <span className="mt-1 text-[16px] font-bold leading-none text-[#333333] md:text-[22px] lg:text-[24px]">{item.value}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </section>

          <Card className="rounded-xl border-0 p-3 shadow-[0_1px_3px_rgba(0,0,0,0.1)] sm:p-4">
            <div className="hidden md:grid md:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)_112px_112px_132px] md:items-end md:gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={filterLabelClass}>通用搜索</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <div className="relative" onFocus={() => setGeneralSuggestionOpen(true)} onBlur={() => window.setTimeout(() => setGeneralSuggestionOpen(false), 120)}>
                    <Input
                      className="h-10 pl-9"
                      placeholder="搜索公司 / 岗位 / 岗位类别等关键词"
                      value={filters.generalKeyword}
                      onChange={(e) => setFilters((prev) => ({ ...prev, generalKeyword: e.target.value }))}
                    />
                    <KeywordSuggestionDropdown
                      visible={generalSuggestionOpen && Boolean(filters.generalKeyword.trim())}
                      loading={generalKeywordSuggestions.loading}
                      suggestions={generalKeywordSuggestions.suggestions}
                      onSelect={(item) => applyKeywordSuggestion('generalKeyword', item)}
                    />
                  </div>
                </div>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className={filterLabelClass}>城市</span>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <div className="relative" onFocus={() => setCitySuggestionOpen(true)} onBlur={() => window.setTimeout(() => setCitySuggestionOpen(false), 120)}>
                    <Input
                      className="h-10 pl-9"
                      placeholder="输入城市，如：北京 / 上海"
                      value={filters.cityKeyword}
                      onChange={(e) => setFilters((prev) => ({ ...prev, cityKeyword: e.target.value }))}
                    />
                    <KeywordSuggestionDropdown
                      visible={citySuggestionOpen && Boolean(filters.cityKeyword.trim())}
                      loading={cityKeywordSuggestions.loading}
                      suggestions={cityKeywordSuggestions.suggestions}
                      onSelect={(item) => applyKeywordSuggestion('cityKeyword', item)}
                    />
                  </div>
                </div>
              </label>

              <Button className="h-10 bg-[#FF8002] hover:bg-[#E67200]" onClick={runSearch}>
                <Search className="mr-1 h-4 w-4" />
                搜索
              </Button>
              <Button className="h-10 border border-[#FF8002] bg-transparent text-[#FF8002] hover:bg-[#FFF7ED]" onClick={resetFilters}>
                <RotateCcw className="mr-1 h-4 w-4" />
                重置
              </Button>
              <Button
                className="h-10 border border-slate-200 bg-white text-[#333333] hover:border-orange-200 hover:bg-[#FFF7ED]"
                onClick={() => setFiltersExpanded((prev) => !prev)}
              >
                {filtersExpanded ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
                {filtersExpanded ? '收起筛选' : getAdvancedFilterCount(filters) ? `展开筛选（${getAdvancedFilterCount(filters)}）` : '展开筛选'}
              </Button>
            </div>

            <div className="grid gap-2.5 md:hidden">
              <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.95fr)] gap-2">
                <label className="flex flex-col gap-1.5">
                  <span className={filterLabelClass}>通用搜索</span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <div className="relative" onFocus={() => setGeneralSuggestionOpen(true)} onBlur={() => window.setTimeout(() => setGeneralSuggestionOpen(false), 120)}>
                      <Input
                        className="h-10 pl-9"
                        placeholder="搜索关键词"
                        value={filters.generalKeyword}
                        onChange={(e) => setFilters((prev) => ({ ...prev, generalKeyword: e.target.value }))}
                      />
                      <KeywordSuggestionDropdown
                        visible={generalSuggestionOpen && Boolean(filters.generalKeyword.trim())}
                        loading={generalKeywordSuggestions.loading}
                        suggestions={generalKeywordSuggestions.suggestions}
                        onSelect={(item) => applyKeywordSuggestion('generalKeyword', item)}
                      />
                    </div>
                  </div>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className={filterLabelClass}>城市</span>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <div className="relative" onFocus={() => setCitySuggestionOpen(true)} onBlur={() => window.setTimeout(() => setCitySuggestionOpen(false), 120)}>
                      <Input
                        className="h-10 pl-9"
                        placeholder="输入城市"
                        value={filters.cityKeyword}
                        onChange={(e) => setFilters((prev) => ({ ...prev, cityKeyword: e.target.value }))}
                      />
                      <KeywordSuggestionDropdown
                        visible={citySuggestionOpen && Boolean(filters.cityKeyword.trim())}
                        loading={cityKeywordSuggestions.loading}
                        suggestions={cityKeywordSuggestions.suggestions}
                        onSelect={(item) => applyKeywordSuggestion('cityKeyword', item)}
                      />
                    </div>
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Button className="h-10 bg-[#FF8002] px-2 text-xs hover:bg-[#E67200]" onClick={runSearch}>
                  <Search className="mr-1 h-3.5 w-3.5" />
                  搜索
                </Button>
                <Button className="h-10 border border-[#FF8002] bg-transparent px-2 text-xs text-[#FF8002] hover:bg-[#FFF7ED]" onClick={resetFilters}>
                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                  重置
                </Button>
                <Button
                  className="h-10 border border-slate-200 bg-white px-2 text-xs text-[#333333] hover:border-orange-200 hover:bg-[#FFF7ED]"
                  onClick={() => setFiltersExpanded((prev) => !prev)}
                >
                  {filtersExpanded ? <ChevronUp className="mr-1 h-3.5 w-3.5" /> : <ChevronDown className="mr-1 h-3.5 w-3.5" />}
                  {filtersExpanded ? '收起' : '展开'}
                </Button>
              </div>
            </div>

            {filtersExpanded ? (
              <div className="mt-3 rounded-2xl border border-[#F3F4F6] bg-[#FCFCFD] p-3">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <label className="flex flex-col gap-1.5">
                    <span className={filterLabelClass}>学历层次</span>
                    <MultiSelectDropdown
                      label="学历层次"
                      placeholder="选择学历层次"
                      options={advancedFilterOptions.degreeRequirement}
                      values={filters.degreeRequirement}
                      onToggle={(value) => toggleMultiFilterValue('degreeRequirement', value)}
                      onClear={() => setFilters((prev) => ({ ...prev, degreeRequirement: [] }))}
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className={filterLabelClass}>企业性质</span>
                    <MultiSelectDropdown
                      label="企业性质"
                      placeholder="选择企业性质"
                      options={advancedFilterOptions.enterpriseNature}
                      values={filters.enterpriseNature}
                      onToggle={(value) => toggleMultiFilterValue('enterpriseNature', value)}
                      onClear={() => setFilters((prev) => ({ ...prev, enterpriseNature: [] }))}
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className={filterLabelClass}>招聘类型</span>
                    <MultiSelectDropdown
                      label="招聘类型"
                      placeholder="选择招聘类型"
                      options={advancedFilterOptions.recruitmentType}
                      values={filters.recruitmentType}
                      onToggle={(value) => toggleMultiFilterValue('recruitmentType', value)}
                      onClear={() => setFilters((prev) => ({ ...prev, recruitmentType: [] }))}
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className={filterLabelClass}>更新时间</span>
                    <MultiSelectDropdown
                      label="更新时间"
                      placeholder="选择更新时间"
                      options={advancedFilterOptions.updatedWithinDays}
                      values={filters.updatedWithinDays}
                      onToggle={(value) => toggleMultiFilterValue('updatedWithinDays', value)}
                      onClear={() => setFilters((prev) => ({ ...prev, updatedWithinDays: [] }))}
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {renderFilterTagRow()}
          </Card>

          <MembershipPromoCard onUpgrade={() => router.push('/membership')} user={mounted ? user : null} />

          <section className="overflow-hidden rounded-xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
            <div className="border-b border-[#F3F4F6] px-3 py-3 sm:px-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  {(['all', 'recommended'] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={cn(
                        toolbarChipBase,
                        tab === item ? 'bg-[#FF8002] text-white' : 'bg-[#F9FAFB] text-[#666666] hover:bg-[#F3F4F6]',
                      )}
                      onClick={() => void handleTabChange(item)}
                    >
                      {item === 'all' ? <Building2 className="mr-1.5 h-4 w-4" /> : <Star className="mr-1.5 h-4 w-4" />}
                      {item === 'all' ? '全部招聘' : '专属推荐'}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-[#F9FAFB] px-3 py-2 text-sm text-[#666666]">共 {totalCount} 条结果</span>
                  <button
                    type="button"
                    className={cn(
                      'hidden md:inline-flex h-9 w-9 items-center justify-center rounded-lg transition',
                      view === 'card' ? 'bg-[#FF8002] text-white' : 'bg-[#F9FAFB] text-[#666666] hover:bg-[#F3F4F6]',
                    )}
                    onClick={() => setView('card')}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'hidden md:inline-flex h-9 w-9 items-center justify-center rounded-lg transition',
                      view === 'list' ? 'bg-[#FF8002] text-white' : 'bg-[#F9FAFB] text-[#666666] hover:bg-[#F3F4F6]',
                    )}
                    onClick={() => setView('list')}
                  >
                    <Rows3 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {tab === 'recommended' ? renderRecommendedFeedNotice() : null}

            {jobs.length === 0 && !loading ? (
              <div className="px-4 py-12 text-center text-sm text-slate-500">
                {tab === 'recommended' ? getRecommendedEmptyText() : '当前暂无符合条件的岗位，试试调整筛选条件后再搜索。'}
              </div>
            ) : view === 'list' ? (
              <>
                <div className="hidden bg-[#FF8002] px-3 py-2.5 text-[13px] font-medium text-white md:grid md:grid-cols-[78px_0.98fr_0.56fr_1.12fr_1.45fr_1.45fr_98px_152px] md:gap-3.5">
                  <div>更新日期</div>
                  <div>企业全称</div>
                  <div>招聘要求</div>
                  <div>招聘地区</div>
                  <div>招聘岗位</div>
                  <div>专业需求</div>
                  <div>截止日期</div>
                  <div>会员操作区</div>
                </div>
                <div>
                  {jobs.map((job) => (
                    <JobRow
                      key={job.id}
                      job={job}
                      mounted={mounted}
                      onViewAnnouncement={handleViewAnnouncement}
                      onDeliver={handleDeliver}
                      onProgress={handleProgress}
                      onReferral={handleReferral}
                      progressOptions={progressOptions}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="grid gap-3 bg-white p-3 md:grid-cols-2 xl:grid-cols-3">
                {jobs.map((job) => {
                  const updatedToday = mounted && isUpdatedToday(getDisplayUpdateDate(job));

                  return (
                    <Card key={job.id} className="rounded-xl border border-slate-100 p-3 shadow-none transition hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
                      {/* 第一行：企业名称 */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <HoverPreviewText label="企业名称" text={getDisplayCompanyFullName(job)} className="font-semibold text-[13px] text-[#333333]" lines={2} />
                        </div>
                        {updatedToday ? <span className="inline-flex shrink-0 rounded-md bg-orange-100 px-2 py-0.5 text-[10px] font-bold leading-none text-[#FF8002]">最新</span> : null}
                      </div>

                      {/* 第二行：更新日期、企业性质、学历要求、招聘类型（紧凑横向排列） */}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-[#666666]">
                        <span className="text-[#9CA3AF]">{formatDate(getDisplayUpdateDate(job))}</span>
                        {job.enterpriseNature ? (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{job.enterpriseNature}</span>
                        ) : null}
                        {job.degreeRequirement ? (
                          <span className="rounded bg-orange-50 px-1.5 py-0.5 text-[10px] text-[#FF8002]">{job.degreeRequirement}</span>
                        ) : null}
                        {job.recruitmentType ? (
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-600">{job.recruitmentType}</span>
                        ) : null}
                      </div>

                      {/* 第三行：招聘岗位 */}
                      <div className="mt-2">
                        <HoverPreviewText label="招聘岗位" text={getDisplayJobName(job)} className="text-[13px] font-medium text-[#333333]" lines={2} />
                      </div>

                      {/* 第四行：招聘地区 */}
                      <div className="mt-1.5 inline-flex items-start gap-1 text-[11px] text-[#666666]">
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-[#FF8002]" />
                        <span className="line-clamp-1">{job.workLocation || '工作地点待定'}</span>
                      </div>

                      {/* 操作区：4按钮横向1行排列 */}
                      <div className="mt-3">
                        <MobileActionGrid
                          job={job}
                          onViewAnnouncement={handleViewAnnouncement}
                          onDeliver={handleDeliver}
                          onProgress={handleProgress}
                          onReferral={handleReferral}
                          progressOptions={progressOptions}
                        />
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {loading ? <div className="border-t border-[#F3F4F6] px-4 py-4 text-center text-sm text-[#666666]">正在加载数据...</div> : null}
            {!pagination.hasMore ? (
              <div className="border-t border-[#F3F4F6] px-4 py-4 text-center text-sm text-[#666666]">没有更多了</div>
            ) : (
              <div ref={loaderRef} className="h-6" />
            )}
          </section>
        </div>

        {serviceProducts.length ? (
          <aside className="min-w-0 xl:sticky xl:top-[84px] xl:self-start xl:min-w-[220px]">
            <div className="hidden xl:block">{renderServiceModule('desktop')}</div>
            <div className="xl:hidden">{renderServiceModule('mobile')}</div>
          </aside>
        ) : null}
      </div>

      {activeClipboardModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6" onClick={closeClipboardModal}>
          <Card className="w-full max-w-md p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-ink">{activeClipboardModal.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{activeClipboardModal.description}</p>
              </div>
              <Button variant="ghost" className="px-2 py-1 text-sm" onClick={closeClipboardModal} disabled={copyingClipboardValue}>
                关闭
              </Button>
            </div>
            <div className="mt-5 rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FF8002]">内容</p>
              <p className="mt-2 break-all text-base font-semibold text-[#333333]">{activeClipboardModal.value}</p>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={closeClipboardModal} disabled={copyingClipboardValue}>
                取消
              </Button>
              <Button onClick={() => void copyClipboardModalValue()} disabled={copyingClipboardValue}>
                {copyingClipboardValue ? '复制中...' : activeClipboardModal.confirmText}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
        <MemberAccessDialog
          open={Boolean(memberAccessMessage)}
          message={memberAccessMessage}
          onClose={() => setMemberAccessMessage('')}
          onConfirm={() => {
            setMemberAccessMessage('');
            router.push('/membership');
          }}
        />
      </main>
    </>
  );
}
