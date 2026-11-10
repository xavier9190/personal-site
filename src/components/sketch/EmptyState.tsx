import type { ReactNode } from 'react';
import { SketchCard } from './SketchCard';
import { SketchButton } from './SketchButton';
import type { SketchAccentColor } from '@/lib/utils';

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  accentColor?: SketchAccentColor;
  icon?: ReactNode;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  accentColor = 'yellow',
  icon,
}: EmptyStateProps) {
  return (
    <SketchCard
      variant="dashed"
      accentBorder={accentColor}
      className="flex w-full flex-col items-center justify-center gap-3 py-10 text-center"
    >
      {icon && <div className="text-[#f1f3f5] opacity-80">{icon}</div>}
      <h3 className="text-base tracking-wider text-[#f1f3f5] uppercase">{title}</h3>
      <p className="max-w-md text-xs text-[#868e96] uppercase">{description}</p>
      {actionLabel && (
        <SketchButton
          variant="outline"
          accentColor={accentColor}
          onClick={onAction}
          className="mt-2"
        >
          {actionLabel}
        </SketchButton>
      )}
    </SketchCard>
  );
}
