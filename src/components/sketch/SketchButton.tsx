import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn, type SketchAccentColor } from '@/lib/utils';

export interface SketchButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'default' | 'filled' | 'outline' | 'ghost';
  accentColor?: SketchAccentColor;
}

const FILLED_ACCENT_CLASS: Record<SketchAccentColor, string> = {
  green: 'bg-[#b2f2bb] text-[#121212] border-[#f1f3f5] hover:brightness-95',
  red: 'bg-[#ffc9c9] text-[#121212] border-[#f1f3f5] hover:brightness-95',
  blue: 'bg-[#a5d8ff] text-[#121212] border-[#f1f3f5] hover:brightness-95',
  yellow: 'bg-[#ffec99] text-[#121212] border-[#f1f3f5] hover:brightness-95',
};

const OUTLINE_ACCENT_CLASS: Record<SketchAccentColor, string> = {
  green: 'bg-[#1e1e1e] text-[#b2f2bb] border-[#b2f2bb] hover:bg-[#b2f2bb] hover:text-[#121212]',
  red: 'bg-[#1e1e1e] text-[#ffc9c9] border-[#ffc9c9] hover:bg-[#ffc9c9] hover:text-[#121212]',
  blue: 'bg-[#1e1e1e] text-[#a5d8ff] border-[#a5d8ff] hover:bg-[#a5d8ff] hover:text-[#121212]',
  yellow: 'bg-[#1e1e1e] text-[#ffec99] border-[#ffec99] hover:bg-[#ffec99] hover:text-[#121212]',
};

export function SketchButton({
  children,
  className,
  variant = 'default',
  accentColor,
  type = 'button',
  ...props
}: SketchButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border-2 px-4 py-2 text-sm font-normal uppercase tracking-wider transition-all active:translate-x-[1px] active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'default' &&
          'border-[#f1f3f5] bg-[#1e1e1e] text-[#f1f3f5] sketch-shadow hover:bg-[#2a2a2a]',
        variant === 'filled' &&
          (accentColor
            ? FILLED_ACCENT_CLASS[accentColor]
            : 'border-[#f1f3f5] bg-[#f1f3f5] text-[#121212]'),
        variant === 'outline' &&
          (accentColor
            ? OUTLINE_ACCENT_CLASS[accentColor]
            : 'border-[#f1f3f5] bg-transparent text-[#f1f3f5] hover:bg-[#1e1e1e]'),
        variant === 'ghost' &&
          'border-transparent bg-transparent text-[#f1f3f5] hover:border-[#f1f3f5] hover:bg-[#1e1e1e]',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
