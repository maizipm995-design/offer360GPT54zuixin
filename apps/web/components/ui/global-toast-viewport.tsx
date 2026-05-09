'use client';

import { useToastStore } from '@/store/toast-store';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

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
              item.type === 'error'
                ? 'bg-red-600 text-white shadow-[0_18px_48px_rgba(220,38,38,0.38)]'
                : 'border border-slate-100 bg-white text-[#FF7D00] shadow-[0_12px_32px_rgba(0,0,0,0.08)]',
            )}
          >
            {item.type === 'error' ? (
              <AlertCircle className="h-5 w-5 shrink-0 text-red-100" />
            ) : (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
            )}
            <span className="flex-1">{item.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
