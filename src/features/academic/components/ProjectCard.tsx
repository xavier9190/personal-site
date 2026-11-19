'use client';

import { ExternalLink } from 'lucide-react';
import { SketchButton } from '@/components/sketch/SketchButton';
import { cn } from '@/lib/utils';
import { formatPureDateBR } from '@/lib/dates';
import type { AcademicProjectView } from '../service';

export interface ProjectCardProps {
  project: AcademicProjectView;
  isSelected?: boolean;
  onClick: () => void;
  onStart?: () => void;
  starting?: boolean;
}

export function ProjectCard({
  project,
  isSelected,
  onClick,
  onStart,
  starting = false,
}: ProjectCardProps) {
  const isCompleted = project.status === 'COMPLETED';
  const isPlanned = project.status === 'PLANNED';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'flex flex-col justify-between rounded-xl border-2 p-4 text-left cursor-pointer bg-[#1e1e1e] transition-opacity',
        isSelected
          ? 'border-dashed border-[#f1f3f5] ring-2 ring-[#f1f3f5]/40'
          : 'border-[#f1f3f5]',
        isCompleted && 'opacity-70 hover:opacity-100',
      )}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-[#f1f3f5] line-clamp-2">{project.title}</p>
          {project.totalMilestones > 0 && (
            <span className="shrink-0 rounded border-2 border-[#f1f3f5] px-1.5 py-0.5 text-[10px] tracking-wider text-[#f1f3f5]">
              {project.completedMilestones}/{project.totalMilestones} MARCOS
            </span>
          )}
        </div>

        <p className="mt-1 text-xs text-[#868e96] line-clamp-2">{project.description}</p>

        {project.finalDeliveryDate && (
          <p className="mt-2 text-xs text-[#f1f3f5]">
            ENTREGA: {formatPureDateBR(project.finalDeliveryDate)}
          </p>
        )}

        {project.groupMembersList.length > 0 && (
          <p className="mt-1 text-xs text-[#868e96] truncate">
            GRUPO: {project.groupMembersList.join(', ')}
          </p>
        )}
      </div>

      {(project.links.length > 0 || (isPlanned && onStart)) && (
        <div
          className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#f1f3f5]/20 pt-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-wrap gap-2">
            {project.links.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex min-h-[32px] items-center gap-1 whitespace-nowrap rounded-lg border-2 border-[#f1f3f5] bg-[#121212] px-2.5 py-1 text-xs text-[#f1f3f5] hover:bg-[#f1f3f5] hover:text-[#121212] transition-colors"
              >
                <span>{link.label}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            ))}
          </div>

          {isPlanned && onStart && (
            <SketchButton
              type="button"
              variant="filled"
              disabled={starting}
              onClick={onStart}
              className="min-h-[32px] shrink-0 px-3 py-1 text-xs whitespace-nowrap"
            >
              {starting ? 'INICIANDO...' : 'COMECEI A FAZER ▶'}
            </SketchButton>
          )}
        </div>
      )}
    </div>
  );
}
