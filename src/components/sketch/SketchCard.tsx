import type { HTMLAttributes, ReactNode } from 'react';
import { cn, type SketchAccentColor } from '@/lib/utils';

export interface SketchCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'dashed' | 'muted';
  accentBorder?: SketchAccentColor;
  filledColor?: SketchAccentColor;
}

const ACCENT_BORDER_CLASS: Record<SketchAccentColor, string> = {
  green: 'border-[#b2f2bb]',
  red: 'border-[#ffc9c9]',
  blue: 'border-[#a5d8ff]',
  yellow: 'border-[#ffec99]',
};

const FILLED_COLOR_CLASS: Record<SketchAccentColor, string> = {
  green: 'bg-[#b2f2bb] text-[#121212] border-[#f1f3f5]',
  red: 'bg-[#ffc9c9] text-[#121212] border-[#f1f3f5]',
  blue: 'bg-[#a5d8ff] text-[#121212] border-[#f1f3f5]',
  yellow: 'bg-[#ffec99] text-[#121212] border-[#f1f3f5]',
};

export function SketchCard({
  children,
  className,
  variant = 'default',
  accentBorder,
  filledColor,
  ...props
}: SketchCardProps) {
  return (
    <div
      className={cn(
        'rounded-md border-2 p-4 uppercase transition-colors',
        filledColor
          ? FILLED_COLOR_CLASS[filledColor]
          : 'bg-[#1e1e1e] text-[#f1f3f5] border-[#f1f3f5]',
        variant === 'dashed' && 'border-dashed',
        variant === 'muted' && 'opacity-60 text-[#868e96] border-[#868e96]',
        accentBorder && !filledColor && ACCENT_BORDER_CLASS[accentBorder],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
