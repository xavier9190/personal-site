import type { ReactNode } from 'react';
import { SketchCard } from './SketchCard';
import { SketchAddButton } from './SketchAddButton';

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: EmptyStateProps) {
  return (
    <SketchCard
      variant="dashed"
      className="flex w-full flex-col items-center justify-center gap-3 py-10 text-center"
    >
      {icon && <div className="text-[#f1f3f5] opacity-80">{icon}</div>}
      <h3 className="text-base tracking-wider text-[#f1f3f5] uppercase">{title}</h3>
      <p className="max-w-md text-xs text-[#868e96] uppercase">{description}</p>
      {actionLabel && (
        <SketchAddButton
          variant="outline"
          label={actionLabel}
          onClick={onAction}
          className="mt-2"
        />
      )}
    </SketchCard>
  );
}
