import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60',
          variant === 'primary' && 'bg-brand text-white shadow-card hover:bg-brand-dark',
          variant === 'secondary' && 'border border-slate-200 bg-white text-ink hover:border-brand hover:text-brand',
          variant === 'ghost' && 'bg-transparent text-muted hover:bg-brand/10 hover:text-brand',
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';
