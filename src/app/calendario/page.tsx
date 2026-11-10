import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/sketch/EmptyState';
import { SketchCard } from '@/components/sketch/SketchCard';
import { SketchBadge } from '@/components/sketch/SketchBadge';

export const dynamic = 'force-dynamic';

export default function CalendarioPage() {
  const db = getDb();
  const events = db.select().from(schema.calendarEvents).all();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        moduleId="calendar"
        subtitle="AGENDA PRÓPRIA E PROJEÇÃO UNIFICADA (ACADÊMICO, FINANÇAS E COMPRAS)"
      />

      <div className="flex flex-wrap items-center gap-2">
        <SketchBadge color="green">REUNIÃO / ENTREGA (#B2F2BB)</SketchBadge>
        <SketchBadge color="red">CONTA / PRAZO (#FFC9C9)</SketchBadge>
        <SketchBadge color="blue">EVENTO AGENDA (#A5D8FF)</SketchBadge>
        <SketchBadge color="yellow">MARCO ACADÊMICO (#FFEC99)</SketchBadge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <SketchCard className="min-h-[420px]">
            {events.length === 0 ? (
              <EmptyState
                title="NENHUM EVENTO OU PRAZO NA GRADE"
                description="CLIQUE EM + NOVA AGENDA PARA CRIAR UM COMPROMISSO OU CADASTRE PRAZOS NOS OUTROS MÓDULOS."
                actionLabel="+ NOVA AGENDA"
                accentColor="blue"
              />
            ) : null}
          </SketchCard>
        </section>

        <aside className="flex flex-col gap-4">
          <SketchCard className="space-y-3">
            <h2 className="border-b border-[#f1f3f5] pb-2 text-sm tracking-wider">
              AGENDAS DE HOJE
            </h2>
            <EmptyState
              title="DIA LIVRE HOJE"
              description="NENHUM COMPROMISSO PARA A DATA ATUAL EM AMERICA/RECIFE."
              accentColor="yellow"
            />
          </SketchCard>
        </aside>
      </div>
    </div>
  );
}
