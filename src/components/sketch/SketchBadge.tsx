import type { HTMLAttributes, ReactNode } from 'react';
import { cn, type SketchAccentColor } from '@/lib/utils';

export interface SketchBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  color?: SketchAccentColor | 'neutral';
  filled?: boolean;
}

export function SketchBadge({
  children,
  className,
  color = 'neutral',
  filled = true,
  ...props
}: SketchBadgeProps) {
  const colorClasses = {
    green: filled
      ? 'bg-[#b2f2bb] text-[#121212] border-[#f1f3f5]'
      : 'bg-[#1e1e1e] text-[#b2f2bb] border-[#b2f2bb]',
    red: filled
      ? 'bg-[#ffc9c9] text-[#121212] border-[#f1f3f5]'
      : 'bg-[#1e1e1e] text-[#ffc9c9] border-[#ffc9c9]',
    blue: filled
      ? 'bg-[#a5d8ff] text-[#121212] border-[#f1f3f5]'
      : 'bg-[#1e1e1e] text-[#a5d8ff] border-[#a5d8ff]',
    yellow: filled
      ? 'bg-[#ffec99] text-[#121212] border-[#f1f3f5]'
      : 'bg-[#1e1e1e] text-[#ffec99] border-[#ffec99]',
    neutral: 'bg-[#1e1e1e] text-[#f1f3f5] border-[#f1f3f5]',
  }[color];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-2 py-0.5 text-xs uppercase tracking-wider',
        colorClasses,
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
