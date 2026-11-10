'use client';

import { useTransition } from 'react';
import { ExternalLink } from 'lucide-react';
import { SketchModal } from '@/components/sketch/SketchModal';
import { SketchButton } from '@/components/sketch/SketchButton';
import { formatPureDateBR } from '@/lib/dates';
import type { AcademicProjectView } from '../service';
import {
  completeProjectAction,
  deleteProjectAction,
  reopenProjectAction,
} from '../actions';
import { MilestoneTimeline } from './MilestoneTimeline';

export interface ProjectDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: AcademicProjectView | null;
  onEdit: (project: AcademicProjectView) => void;
}

export function ProjectDetailsModal({
  isOpen,
  onClose,
  project,
  onEdit,
}: ProjectDetailsModalProps) {
  const [pending, startTransition] = useTransition();

  if (!project) return null;

  const isCompleted = project.status === 'COMPLETED';

  function handleToggleStatus() {
    if (!project) return;
    startTransition(async () => {
      if (isCompleted) {
        await reopenProjectAction(project.id);
      } else {
        await completeProjectAction(project.id);
      }
    });
  }

  function handleDelete() {
    if (!project) return;
    startTransition(async () => {
      const res = await deleteProjectAction(project.id);
      if (res.ok) {
        onClose();
      }
    });
  }

  return (
    <SketchModal isOpen={isOpen} onClose={onClose} title={project.title}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f1f3f5]/20 pb-3">
          <span className="rounded border border-[#f1f3f5] px-2 py-0.5 text-xs tracking-wider">
            {isCompleted ? 'STATUS: CONCLUÍDO' : 'STATUS: EM ANDAMENTO'}
          </span>
          <SketchButton
            variant="outline"
            className="min-h-[32px] h-8 px-3 text-xs"
            disabled={pending}
            onClick={handleToggleStatus}
          >
            {isCompleted ? 'REABRIR PROJETO ⟲' : 'CONCLUIR PROJETO ✓'}
          </SketchButton>
        </div>

        <div>
          <h4 className="text-xs font-bold text-[#868e96] tracking-wider mb-1">DESCRIÇÃO</h4>
          <p className="text-xs text-[#f1f3f5] leading-relaxed whitespace-pre-wrap">
            {project.description}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <h4 className="text-xs font-bold text-[#868e96] tracking-wider mb-1">
              DATA DA ENTREGA FINAL
            </h4>
            <p className="text-[#f1f3f5]">
              {project.finalDeliveryDate
                ? formatPureDateBR(project.finalDeliveryDate)
                : 'NÃO DEFINIDA'}
            </p>
          </div>

          <div>
            <h4 className="text-xs font-bold text-[#868e96] tracking-wider mb-1">GRUPO</h4>
            <p className="text-[#f1f3f5]">
              {project.groupMembersList.length > 0
                ? project.groupMembersList.join(', ')
                : 'INDIVIDUAL'}
            </p>
          </div>
        </div>

        {project.links.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-[#868e96] tracking-wider mb-1.5">LINKS</h4>
            <div className="flex flex-wrap gap-2">
              {project.links.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#f1f3f5] px-2.5 py-1 text-xs text-[#f1f3f5] hover:bg-[#f1f3f5] hover:text-[#121212] transition-colors"
                >
                  <span>{link.label}</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-[#f1f3f5]/20 pt-3">
          <MilestoneTimeline projectId={project.id} milestones={project.milestones} />
        </div>

        <div className="flex items-center justify-between border-t border-[#f1f3f5]/20 pt-3">
          <SketchButton
            variant="ghost"
            disabled={pending}
            onClick={handleDelete}
            className="text-xs"
          >
            EXCLUIR
          </SketchButton>

          <div className="flex gap-2">
            <SketchButton
              variant="outline"
              disabled={pending}
              onClick={() => {
                onClose();
                onEdit(project);
              }}
              className="text-xs"
            >
              EDITAR
            </SketchButton>
            <SketchButton variant="ghost" onClick={onClose} className="text-xs">
              FECHAR
            </SketchButton>
          </div>
        </div>
      </div>
    </SketchModal>
  );
}
