import type { HTMLAttributes, ReactNode } from 'react';
import { cn, type SketchAccentColor } from '@/lib/utils';

export interface SketchCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'dashed' | 'muted';
  calendarColor?: SketchAccentColor;
}

const CALENDAR_EVENT_COLOR_CLASS: Record<SketchAccentColor, string> = {
  green: 'bg-[#b2f2bb] text-[#121212] border-[#f1f3f5]',
  red: 'bg-[#ffc9c9] text-[#121212] border-[#f1f3f5]',
  blue: 'bg-[#a5d8ff] text-[#121212] border-[#f1f3f5]',
  yellow: 'bg-[#ffec99] text-[#121212] border-[#f1f3f5]',
};

export function SketchCard({
  children,
  className,
  variant = 'default',
  calendarColor,
  ...props
}: SketchCardProps) {
  return (
    <div
      className={cn(
        'rounded-md border-2 p-4 uppercase transition-colors',
        calendarColor
          ? CALENDAR_EVENT_COLOR_CLASS[calendarColor]
          : 'border-[#f1f3f5] bg-[#1e1e1e] text-[#f1f3f5]',
        variant === 'dashed' && 'border-dashed',
        variant === 'muted' && 'border-[#868e96] text-[#868e96] opacity-60',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
