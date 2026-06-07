'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface MemberAccessDialogProps {
  open: boolean;
  title?: string;
  message: string;
  cancelText?: string;
  confirmText?: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function MemberAccessDialog({
  open,
  title = '会员权限提醒',
  message,
  cancelText = '关闭弹窗',
  confirmText = '去开通会员',
  onClose,
  onConfirm,
}: MemberAccessDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <Card className="w-full max-w-md p-6">
        <h3 className="text-xl font-bold text-ink">{title}</h3>
        <p className="mt-3 text-sm leading-6 text-muted">{message}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={onClose}>
            {cancelText}
          </Button>
          <Button onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </Card>
    </div>
  );
}
