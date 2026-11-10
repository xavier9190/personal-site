import { AcademicService } from '@/features/academic/service';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/sketch/EmptyState';

export const dynamic = 'force-dynamic';

export default function AcademicoPage() {
  const academicService = new AcademicService();
  const { inProgress, completed } = academicService.listProjectsByStatus();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        moduleId="academic"
        subtitle="PROJETOS EM ANDAMENTO, MARCOS IMPORTANTES E ENTREGAS"
      />

      <section className="space-y-3">
        <h2 className="text-base tracking-wider">PROJETOS EM ANDAMENTO</h2>
        {inProgress.length === 0 ? (
          <EmptyState
            title="NENHUM PROJETO EM ANDAMENTO"
            description="CADASTRE SEUS PROJETOS DA FACULDADE COM GRUPO, LINKS EXTERNOS E LINHA DO TEMPO DE MARCOS."
            actionLabel="+ ADICIONAR"
            accentColor="yellow"
          />
        ) : null}
      </section>

      <section className="space-y-3 opacity-80">
        <h2 className="text-base tracking-wider text-[#868e96]">
          PROJETOS JÁ ACABADOS
        </h2>
        {completed.length === 0 ? (
          <EmptyState
            title="NENHUM PROJETO CONCLUÍDO AINDA"
            description="PROJETOS FINALIZADOS FICARÃO ARQUIVADOS NESTA SEÇÃO."
            accentColor="blue"
          />
        ) : null}
      </section>
    </div>
  );
}
