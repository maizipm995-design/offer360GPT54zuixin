'use client';

import { useToastStore } from '@/store/toast-store';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, CircleAlert, Info } from 'lucide-react';

const TOAST_STYLE_MAP = {
  success: {
    container: 'bg-emerald-600 text-white shadow-[0_18px_48px_rgba(5,150,105,0.28)]',
    icon: <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-100" />,
  },
  info: {
    container: 'border border-sky-200 bg-sky-50 text-sky-900 shadow-[0_12px_32px_rgba(14,165,233,0.12)]',
    icon: <Info className="h-5 w-5 shrink-0 text-sky-600" />,
  },
  warning: {
    container: 'bg-amber-500 text-white shadow-[0_18px_48px_rgba(245,158,11,0.28)]',
    icon: <CircleAlert className="h-5 w-5 shrink-0 text-amber-100" />,
  },
  error: {
    container: 'bg-red-600 text-white shadow-[0_18px_48px_rgba(220,38,38,0.38)]',
    icon: <AlertCircle className="h-5 w-5 shrink-0 text-red-100" />,
  },
} as const;

export function GlobalToastViewport() {
  const toasts = useToastStore((state) => state.toasts);

  if (!toasts.length) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center p-4 md:items-end md:justify-end md:p-6">
      <div className="flex w-full max-w-[92vw] flex-col gap-3 md:w-auto md:max-w-sm">
        {toasts.map((item) => (
          <div
            key={item.id}
            className={cn(
              'flex items-center gap-3 rounded-2xl px-5 py-3.5 text-sm font-semibold leading-relaxed transition-all animate-in slide-in-from-bottom-2 md:text-left',
              TOAST_STYLE_MAP[item.type].container,
            )}
          >
            {TOAST_STYLE_MAP[item.type].icon}
            <span className="flex-1">{item.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
