'use client';

import { useState, useTransition } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/sketch/EmptyState';
import type { AcademicProjectView } from '../service';
import { startProjectAction } from '../actions';
import { ProjectCard } from './ProjectCard';
import { ProjectDetailsModal } from './ProjectDetailsModal';
import { ProjectFormModal } from './ProjectFormModal';

export interface AcademicDashboardClientProps {
  planned: AcademicProjectView[];
  inProgress: AcademicProjectView[];
  completed: AcademicProjectView[];
}

export function AcademicDashboardClient({
  planned,
  inProgress,
  completed,
}: AcademicDashboardClientProps) {
  const [selectedProject, setSelectedProject] = useState<AcademicProjectView | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<AcademicProjectView | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Keep details modal synchronized with updated props if open
  const activeDetailsProject = selectedProject
    ? inProgress.find((p) => p.id === selectedProject.id) ||
      planned.find((p) => p.id === selectedProject.id) ||
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

  function handleStartProject(projectId: string) {
    setStartingId(projectId);
    startTransition(async () => {
      try {
        await startProjectAction(projectId);
      } finally {
        setStartingId((current) => (current === projectId ? null : current));
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:h-full md:min-h-0 md:overflow-hidden md:p-6">
      <PageHeader
        moduleId="academic"
        subtitle="PROJETOS EM ANDAMENTO, QUE QUERO FAZER, MARCOS E ENTREGAS"
        onAddClick={handleOpenCreate}
      />

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto pr-1 min-h-0">
        {/* Seção 1: Projetos em Andamento */}
        <section className="flex flex-col space-y-3">
          <div className="flex items-center justify-between border-b border-[#f1f3f5]/20 pb-2">
            <h2 className="text-base tracking-wider text-[#f1f3f5]">
              PROJETOS EM ANDAMENTO ({inProgress.length})
            </h2>
          </div>

          {inProgress.length === 0 ? (
            <EmptyState
              title="NENHUM PROJETO EM ANDAMENTO"
              description="CADASTRE SEUS PROJETOS COM GRUPO, LINKS EXTERNOS E LINHA DO TEMPO DE MARCOS."
              actionLabel="+ ADICIONAR"
              onAction={handleOpenCreate}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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

        {/* Seção 2: Projetos que Quero Fazer */}
        <section className="flex flex-col space-y-3 border-t-2 border-dashed border-[#f1f3f5]/30 pt-4">
          <div className="flex items-center justify-between border-b border-[#f1f3f5]/20 pb-2">
            <h2 className="text-base tracking-wider text-[#f1f3f5]">
              PROJETOS QUE QUERO FAZER ({planned.length})
            </h2>
          </div>

          {planned.length === 0 ? (
            <EmptyState
              title="NENHUM PROJETO NA LISTA DE IDEIAS"
              description="ADICIONE PROJETOS COM STATUS QUERO FAZER E CLIQUE EM COMECEI A FAZER QUANDO INICIAR."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {planned.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  isSelected={activeDetailsProject?.id === project.id}
                  onClick={() => handleSelectCard(project)}
                  onStart={() => handleStartProject(project.id)}
                  starting={startingId === project.id}
                />
              ))}
            </div>
          )}
        </section>

        {/* Seção 3: Projetos Já Acabados */}
        <section className="flex flex-col space-y-3 border-t-2 border-dashed border-[#f1f3f5]/20 pt-4 opacity-85">
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
