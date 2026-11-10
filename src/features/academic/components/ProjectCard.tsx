'use client';

import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPureDateBR } from '@/lib/dates';
import type { AcademicProjectView } from '../service';

export interface ProjectCardProps {
  project: AcademicProjectView;
  isSelected?: boolean;
  onClick: () => void;
}

export function ProjectCard({ project, isSelected, onClick }: ProjectCardProps) {
  const isCompleted = project.status === 'COMPLETED';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'group flex flex-col justify-between rounded-xl border-2 p-4 text-left transition-all cursor-pointer bg-[#121212]',
        isSelected
          ? 'border-dashed border-[#f1f3f5] ring-2 ring-[#f1f3f5]/40'
          : 'border-[#f1f3f5] hover:border-dashed',
        isCompleted && 'opacity-70 hover:opacity-100',
      )}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-bold tracking-wide text-[#f1f3f5] line-clamp-2">
            {project.title}
          </h3>
          {project.totalMilestones > 0 && (
            <span className="shrink-0 rounded-md border border-[#f1f3f5] px-1.5 py-0.5 text-[10px] tracking-wider text-[#f1f3f5]">
              {project.completedMilestones}/{project.totalMilestones} MARCOS
            </span>
          )}
        </div>

        <p className="text-xs text-[#868e96] line-clamp-3 tracking-wide">
          {project.description}
        </p>

        {project.finalDeliveryDate && (
          <p className="text-[11px] text-[#f1f3f5] tracking-wider">
            ENTREGA: {formatPureDateBR(project.finalDeliveryDate)}
          </p>
        )}

        {project.groupMembersList.length > 0 && (
          <p className="text-[10px] text-[#868e96] truncate">
            GRUPO: {project.groupMembersList.join(', ')}
          </p>
        )}
      </div>

      {project.links.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-3 mt-3 border-t border-[#f1f3f5]/20">
          {project.links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-md border border-[#f1f3f5] bg-[#121212] px-2 py-1 text-[10px] text-[#f1f3f5] hover:bg-[#f1f3f5] hover:text-[#121212] transition-colors"
            >
              <span>{link.label}</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
