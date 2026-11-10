import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/sketch/EmptyState';

export const dynamic = 'force-dynamic';

export default function AcademicoPage() {
  const db = getDb();
  const projects = db.select().from(schema.academicProjects).all();
  const inProgress = projects.filter((p) => p.status === 'IN_PROGRESS');
  const completed = projects.filter((p) => p.status === 'COMPLETED');

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
