'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { clientFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { JobSearchSuggestionField, JobSearchSuggestionItem, JobSearchSuggestionResponse } from '@/types';

type UseKeywordSuggestionsOptions = {
  keyword: string;
  field: JobSearchSuggestionField;
  token?: string | null;
  enabled?: boolean;
  limit?: number;
};

export function useKeywordSuggestions({
  keyword,
  field,
  token,
  enabled = true,
  limit = 8,
}: UseKeywordSuggestionsOptions) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<JobSearchSuggestionItem[]>([]);

  useEffect(() => {
    const trimmedKeyword = keyword.trim();
    if (!enabled || !trimmedKeyword) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          keyword: trimmedKeyword,
          field,
          limit: String(limit),
        });
        const result = await clientFetch<JobSearchSuggestionResponse>(`/jobs/suggestions?${params.toString()}`, {}, token || undefined);
        if (!cancelled) {
          setSuggestions(result.list ?? []);
        }
      } catch {
        if (!cancelled) {
          setSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, field, keyword, limit, token]);

  return { loading, suggestions };
}

export function KeywordSuggestionDropdown({
  visible,
  loading,
  suggestions,
  onSelect,
  emptyText = '暂无匹配建议，可直接保留当前输入',
  className,
}: {
  visible: boolean;
  loading: boolean;
  suggestions: JobSearchSuggestionItem[];
  onSelect: (item: JobSearchSuggestionItem) => void;
  emptyText?: string;
  className?: string;
}) {
  if (!visible) {
    return null;
  }

  return (
    <div
      className={cn(
        'absolute left-0 top-full z-30 mt-2 w-full overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-[0_16px_32px_rgba(15,23,42,0.12)]',
        className,
      )}
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 px-4 py-4 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>正在生成推荐词...</span>
        </div>
      ) : suggestions.length ? (
        <div className="max-h-72 overflow-y-auto p-2">
          {suggestions.map((item) => (
            <button
              key={`${item.domain}-${item.value}`}
              type="button"
              className="flex w-full flex-col items-start gap-1 rounded-xl px-3 py-3 text-left transition hover:bg-orange-50"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onSelect(item)}
            >
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-[#FF8002]">{item.domainLabel}</span>
                <span className="text-sm font-semibold text-[#333333]">{item.label}</span>
              </div>
              <p className="text-xs text-slate-500">匹配词：{item.matchText}</p>
              {item.relatedKeywords.length > 1 ? (
                <p className="text-xs text-slate-400">关联词：{item.relatedKeywords.slice(0, 4).join(' / ')}</p>
              ) : null}
            </button>
          ))}
        </div>
      ) : (
        <div className="px-4 py-4 text-sm text-slate-500">{emptyText}</div>
      )}
    </div>
  );
}
