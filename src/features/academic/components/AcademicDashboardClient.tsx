'use client';

import { useState } from 'react';
import { SketchAddButton } from '@/components/sketch/SketchAddButton';
import { EmptyState } from '@/components/sketch/EmptyState';
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
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="inline-block border-b-2 border-[#f1f3f5] pb-1 text-xl tracking-wider text-[#f1f3f5] uppercase md:text-2xl">
            ACADÊMICO
          </h1>
          <p className="mt-1 text-xs text-[#868e96] tracking-wider">
            PROJETOS EM ANDAMENTO, MARCOS IMPORTANTES E ENTREGAS
          </p>
        </div>

        <SketchAddButton onClick={handleOpenCreate} />
      </header>

      <section className="flex flex-col space-y-3">
        <div className="flex items-center justify-between border-b border-[#f1f3f5]/20 pb-2">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

      <section className="flex flex-col space-y-3 border-t-2 border-[#f1f3f5] pt-4 opacity-80">
        <div className="flex items-center justify-between border-b border-[#f1f3f5]/20 pb-2">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
