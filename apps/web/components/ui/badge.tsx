import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand',
        className,
      )}
      {...props}
    />
  );
}
