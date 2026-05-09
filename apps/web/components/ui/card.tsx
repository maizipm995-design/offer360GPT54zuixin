import * as React from 'react';
import { cn } from '@/lib/utils';

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return <div ref={ref} className={cn('rounded-2xl border border-slate-200 bg-white shadow-card', className)} {...props} />;
  },
);

Card.displayName = 'Card';
