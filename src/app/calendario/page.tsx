import { CalendarService } from '@/features/calendar/service';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/sketch/EmptyState';
import { SketchCard } from '@/components/sketch/SketchCard';

export const dynamic = 'force-dynamic';

export default function CalendarioPage() {
  const calendarService = new CalendarService();
  const events = calendarService.listEvents();

  return (
    <div className="flex flex-1 flex-col p-4 md:p-6">
      <PageHeader
        moduleId="calendar"
        subtitle="AGENDA PRÓPRIA E PROJEÇÃO UNIFICADA (ACADÊMICO, FINANÇAS E COMPRAS)"
      />

      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="flex flex-col lg:col-span-2">
          <SketchCard className="flex flex-1 flex-col justify-center">
            {events.length === 0 ? (
              <EmptyState
                title="NENHUM EVENTO OU PRAZO NA GRADE"
                description="CLIQUE EM + ADICIONAR PARA CRIAR UM COMPROMISSO OU CADASTRE PRAZOS NOS OUTROS MÓDULOS."
                actionLabel="+ ADICIONAR"
              />
            ) : null}
          </SketchCard>
        </section>

        <aside className="flex flex-col gap-4">
          <SketchCard className="flex flex-1 flex-col space-y-3">
            <h2 className="border-b border-[#f1f3f5] pb-2 text-sm tracking-wider">
              AGENDAS DE HOJE
            </h2>
            <div className="flex flex-1 flex-col justify-center">
              <EmptyState
                title="DIA LIVRE HOJE"
                description="NENHUM COMPROMISSO PARA A DATA ATUAL EM AMERICA/RECIFE."
              />
            </div>
          </SketchCard>
        </aside>
      </div>
    </div>
  );
}
