import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SketchBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  inverted?: boolean;
}

export function SketchBadge({
  children,
  className,
  inverted = false,
  ...props
}: SketchBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-2 py-0.5 text-xs uppercase tracking-wider',
        inverted
          ? 'border-[#f1f3f5] bg-[#f1f3f5] text-[#121212]'
          : 'border-[#f1f3f5] bg-[#121212] text-[#f1f3f5]',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
