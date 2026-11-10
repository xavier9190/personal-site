'use client';

import type { ReactNode } from 'react';
import { getModuleByPath, type ModuleId, MODULES } from '@/config/modules';
import { SketchButton } from '@/components/sketch/SketchButton';

export interface PageHeaderProps {
  moduleId?: ModuleId;
  pathname?: string;
  title?: string;
  subtitle?: string;
  onAddClick?: () => void;
  extraControls?: ReactNode;
}

export function PageHeader({
  moduleId,
  pathname,
  title,
  subtitle,
  onAddClick,
  extraControls,
}: PageHeaderProps) {
  const mod = moduleId
    ? MODULES.find((m) => m.id === moduleId)
    : pathname
      ? getModuleByPath(pathname)
      : undefined;

  const displayTitle = title ?? mod?.label ?? '';
  const showAdd = mod ? mod.showAddButton : false;
  const addLabel = mod?.addButtonLabel ?? '+ ADICIONAR';

  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b-2 border-[#f1f3f5] pb-4">
      <div>
        <h1 className="text-xl tracking-wider text-[#f1f3f5] uppercase md:text-2xl">
          {displayTitle}
        </h1>
        {subtitle && (
          <p className="mt-1 text-xs text-[#868e96] uppercase">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {extraControls}
        {showAdd && (
          <SketchButton
            variant="default"
            onClick={onAddClick}
            data-testid="module-add-button"
          >
            {addLabel}
          </SketchButton>
        )}
      </div>
    </header>
  );
}
