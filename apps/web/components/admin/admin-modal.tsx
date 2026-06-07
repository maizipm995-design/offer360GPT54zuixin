'use client';

import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

type AdminModalProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  widthClass?: string;
};

export function AdminModal({
  open,
  title,
  description,
  onClose,
  children,
  widthClass = 'max-w-[1280px] lg:max-w-[80vw]',
}: AdminModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-8">
      <div className={`max-h-[90vh] w-full overflow-hidden rounded-[28px] bg-white shadow-2xl ${widthClass}`}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <h3 className="text-2xl font-bold text-ink">{title}</h3>
            {description ? <p className="mt-2 text-sm text-muted">{description}</p> : null}
          </div>
          <Button variant="ghost" onClick={onClose}>
            关闭
          </Button>
        </div>
        <div className="max-h-[calc(90vh-96px)] overflow-y-auto px-6 py-6">{children}</div>
      </div>
    </div>
  );
}
