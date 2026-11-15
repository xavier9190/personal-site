'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/sketch/EmptyState';
import { GripHorizontal } from 'lucide-react';
import type { AcademicProjectView } from '../service';
import { ProjectCard } from './ProjectCard';
import { ProjectDetailsModal } from './ProjectDetailsModal';
import { ProjectFormModal } from './ProjectFormModal';

export interface AcademicDashboardClientProps {
  inProgress: AcademicProjectView[];
  completed: AcademicProjectView[];
}

export function AcademicDashboardClient({
  inProgress,
  completed,
}: AcademicDashboardClientProps) {
  const [selectedProject, setSelectedProject] = useState<AcademicProjectView | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<AcademicProjectView | null>(null);

  // Redimensionamento vertical da seção de projetos em andamento
  const [topPercent, setTopPercent] = useState<number>(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const startDragging = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const stopDragging = useCallback(() => {
    setIsDragging(false);
  }, []);

  const onDrag = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const offsetY = clientY - rect.top;
      const percent = (offsetY / rect.height) * 100;
      // Delimita para não colapsar totalmente (entre 15% e 85%)
      setTopPercent(Math.min(85, Math.max(15, percent)));
    },
    [isDragging]
  );

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', onDrag);
      window.addEventListener('mouseup', stopDragging);
      window.addEventListener('touchmove', onDrag);
      window.addEventListener('touchend', stopDragging);
    }
    return () => {
      window.removeEventListener('mousemove', onDrag);
      window.removeEventListener('mouseup', stopDragging);
      window.removeEventListener('touchmove', onDrag);
      window.removeEventListener('touchend', stopDragging);
    };
  }, [isDragging, onDrag, stopDragging]);

  // Keep details modal synchronized with updated props if open
  const activeDetailsProject = selectedProject
    ? inProgress.find((p) => p.id === selectedProject.id) ||
      completed.find((p) => p.id === selectedProject.id) ||
      null
    : null;

  function handleOpenCreate() {
    setEditingProject(null);
    setFormOpen(true);
  }

  function handleOpenEdit(project: AcademicProjectView) {
    setEditingProject(project);
    setFormOpen(true);
  }

  function handleSelectCard(project: AcademicProjectView) {
    setSelectedProject(project);
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:h-full md:min-h-0 md:overflow-hidden md:p-6 select-none">
      <PageHeader
        moduleId="academic"
        subtitle="PROJETOS EM ANDAMENTO, MARCOS IMPORTANTES E ENTREGAS"
        onAddClick={handleOpenCreate}
      />

      <div
        ref={containerRef}
        className="flex flex-1 flex-col min-h-0 relative"
      >
        {/* Seção Superior: Projetos em Andamento */}
        <section
          style={{ height: `${topPercent}%` }}
          className="flex min-h-0 flex-col space-y-3 pb-2 overflow-hidden transition-[height] duration-75"
        >
          <div className="flex items-center justify-between border-b border-[#f1f3f5]/20 pb-2 shrink-0">
            <h2 className="text-base tracking-wider text-[#f1f3f5]">
              PROJETOS EM ANDAMENTO ({inProgress.length})
            </h2>
          </div>

          {inProgress.length === 0 ? (
            <EmptyState
              title="NENHUM PROJETO EM ANDAMENTO"
              description="CADASTRE SEUS PROJETOS DA FACULDADE COM GRUPO, LINKS EXTERNOS E LINHA DO TEMPO DE MARCOS."
              actionLabel="+ ADICIONAR"
              onAction={handleOpenCreate}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 overflow-y-auto pr-1 flex-1 min-h-0 md:grid-cols-2 lg:grid-cols-3">
              {inProgress.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  isSelected={activeDetailsProject?.id === project.id}
                  onClick={() => handleSelectCard(project)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Divisor / Pipe Horizontal Interativo */}
        <div
          role="separator"
          tabIndex={0}
          aria-label="REDIMENSIONAR SEÇÕES DE PROJETOS"
          onMouseDown={startDragging}
          onTouchStart={startDragging}
          className={`group flex items-center justify-center my-1 cursor-row-resize py-1.5 transition-colors select-none ${
            isDragging ? 'opacity-100' : 'hover:opacity-100'
          }`}
        >
          <div className="w-full relative flex items-center justify-center border-t-2 border-[#f1f3f5] group-hover:border-[#a5d8ff] transition-colors">
            <span className="absolute bg-[#121212] px-3 py-0.5 border border-[#f1f3f5] rounded-full text-[#f1f3f5] group-hover:text-[#a5d8ff] group-hover:border-[#a5d8ff] flex items-center gap-1 text-[10px] tracking-wider transition-colors shadow-sm">
              <GripHorizontal className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>

        {/* Seção Inferior: Projetos Já Acabados */}
        <section
          style={{ height: `${100 - topPercent}%` }}
          className="flex min-h-0 flex-col space-y-3 pt-2 opacity-85 overflow-hidden transition-[height] duration-75"
        >
          <div className="flex items-center justify-between border-b border-[#f1f3f5]/20 pb-2 shrink-0">
            <h2 className="text-base tracking-wider text-[#868e96]">
              PROJETOS JÁ ACABADOS ({completed.length})
            </h2>
          </div>

          {completed.length === 0 ? (
            <EmptyState
              title="NENHUM PROJETO CONCLUÍDO AINDA"
              description="PROJETOS FINALIZADOS FICARÃO ARQUIVADOS NESTA SEÇÃO."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 overflow-y-auto pr-1 flex-1 min-h-0 md:grid-cols-2 lg:grid-cols-3">
              {completed.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  isSelected={activeDetailsProject?.id === project.id}
                  onClick={() => handleSelectCard(project)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <ProjectDetailsModal
        isOpen={Boolean(activeDetailsProject)}
        onClose={() => setSelectedProject(null)}
        project={activeDetailsProject}
        onEdit={handleOpenEdit}
      />

      <ProjectFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        initialProject={editingProject}
      />
    </div>
  );
}
