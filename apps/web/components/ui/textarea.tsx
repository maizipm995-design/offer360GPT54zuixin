import * as React from 'react';
import { cn } from '@/lib/utils';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'min-h-[120px] w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15',
          className,
        )}
        {...props}
      />
    );
  },
);

Textarea.displayName = 'Textarea';
