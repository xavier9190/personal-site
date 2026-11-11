'use client';

import type { ReactNode } from 'react';
import { getModuleByPath, type ModuleId, MODULES } from '@/config/modules';
import { SketchAddButton } from '@/components/sketch/SketchAddButton';

export interface PageHeaderProps {
  moduleId?: ModuleId;
  pathname?: string;
  title?: string;
  subtitle?: string;
  onAddClick?: () => void;
  titleSuffix?: ReactNode;
  extraControls?: ReactNode;
}

export function PageHeader({
  moduleId,
  pathname,
  title,
  subtitle,
  onAddClick,
  titleSuffix,
  extraControls,
}: PageHeaderProps) {
  const mod = moduleId
    ? MODULES.find((m) => m.id === moduleId)
    : pathname
      ? getModuleByPath(pathname)
      : undefined;

  const displayTitle = title ?? mod?.label ?? '';
  const showAdd = mod ? mod.showAddButton : false;

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 shrink-0 min-h-[48px]">
      <div className="flex flex-col justify-center">
        <div className="flex items-center gap-4">
          <h1 className="inline-block border-b-2 border-[#f1f3f5] pb-1 text-xl tracking-wider text-[#f1f3f5] uppercase md:text-2xl leading-none">
            {displayTitle}
          </h1>
          {titleSuffix}
        </div>
        {subtitle && (
          <p className="mt-1 text-xs text-[#868e96] uppercase tracking-wider">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {extraControls}
        {showAdd && <SketchAddButton onClick={onAddClick} />}
      </div>
    </header>
  );
}
