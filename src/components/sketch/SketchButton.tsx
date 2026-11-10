import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SketchButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'default' | 'filled' | 'outline' | 'ghost';
}

export function SketchButton({
  children,
  className,
  variant = 'default',
  type = 'button',
  ...props
}: SketchButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border-2 px-4 py-2 text-sm font-normal uppercase tracking-wider transition-all active:translate-x-[1px] active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'default' &&
          'border-[#f1f3f5] bg-[#121212] text-[#f1f3f5] sketch-shadow hover:bg-[#f1f3f5] hover:text-[#121212]',
        variant === 'filled' &&
          'border-[#f1f3f5] bg-[#f1f3f5] text-[#121212] hover:brightness-95',
        variant === 'outline' &&
          'border-[#f1f3f5] bg-[#121212] text-[#f1f3f5] hover:bg-[#f1f3f5] hover:text-[#121212]',
        variant === 'ghost' &&
          'border-transparent bg-[#121212] text-[#f1f3f5] hover:border-[#f1f3f5]',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
