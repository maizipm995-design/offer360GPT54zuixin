'use client';

import { useToastStore } from '@/store/toast-store';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, CircleAlert, Info } from 'lucide-react';

const TOAST_STYLE_MAP = {
  success: {
    container: 'bg-emerald-600 text-white shadow-[0_10px_24px_rgba(5,150,105,0.18)] md:shadow-[0_18px_48px_rgba(5,150,105,0.28)]',
    icon: <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-100" />,
  },
  info: {
    container: 'border border-sky-200 bg-sky-50 text-sky-900 shadow-[0_8px_20px_rgba(14,165,233,0.1)] md:shadow-[0_12px_32px_rgba(14,165,233,0.12)]',
    icon: <Info className="h-5 w-5 shrink-0 text-sky-600" />,
  },
  warning: {
    container: 'bg-amber-500 text-white shadow-[0_10px_24px_rgba(245,158,11,0.18)] md:shadow-[0_18px_48px_rgba(245,158,11,0.28)]',
    icon: <CircleAlert className="h-5 w-5 shrink-0 text-amber-100" />,
  },
  error: {
    container: 'bg-red-600 text-white shadow-[0_10px_24px_rgba(220,38,38,0.24)] md:shadow-[0_18px_48px_rgba(220,38,38,0.38)]',
    icon: <AlertCircle className="h-5 w-5 shrink-0 text-red-100" />,
  },
} as const;

export function GlobalToastViewport() {
  const toast = useToastStore((state) => state.toasts[0] ?? null);

  if (!toast) {
    return null;
  }

  return (
    <div className="toast-safe-area pointer-events-none fixed z-[200] flex justify-end">
      <div className="w-[min(88vw,24rem)]">
        <div
          key={toast.id}
          className={cn(
            'flex items-center gap-3 rounded-[1.375rem] px-[1.125rem] py-[0.875rem] text-sm font-semibold leading-relaxed transition-all animate-in slide-in-from-bottom-2 md:rounded-2xl md:px-5 md:py-3.5 md:text-left',
            TOAST_STYLE_MAP[toast.type].container,
          )}
        >
          {TOAST_STYLE_MAP[toast.type].icon}
          <span className="flex-1">{toast.message}</span>
        </div>
      </div>
    </div>
  );
}
