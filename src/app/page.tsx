import { ChatService } from '@/features/chat/service';
import { CalendarService } from '@/features/calendar/service';
import { FinancesService } from '@/features/finances/service';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/sketch/EmptyState';
import { SketchCard } from '@/components/sketch/SketchCard';
import { formatCentsToBRL } from '@/lib/currency';

export const dynamic = 'force-dynamic';

export default function ChatPage() {
  const chatService = new ChatService();
  const calendarService = new CalendarService();
  const financesService = new FinancesService();

  const messages = chatService.listMessages();
  const events = calendarService.listEvents();
  const bills = financesService.listPayableBills();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        moduleId="chat"
        subtitle="ASSISTENTE IA INTEGRADO AOS 4 MÓDULOS"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="flex flex-col gap-4 lg:col-span-2">
          <SketchCard className="flex min-h-[420px] flex-col justify-between gap-4">
            {messages.length === 0 ? (
              <EmptyState
                title="NENHUMA MENSAGEM NESTA CONVERSA"
                description="ENVIE UM COMANDO PARA LER, ADICIONAR, EDITAR OU EXCLUIR DADOS EM CALENDÁRIO, FINANÇAS, ACADÊMICO E COMPRAS."
                accentColor="blue"
              />
            ) : null}

            <div className="flex items-center gap-2 border-t-2 border-[#f1f3f5] pt-3">
              <input
                type="text"
                readOnly
                placeholder="DIGITE SUA MENSAGEM PARA A IA..."
                className="flex-1 rounded-md border-2 border-[#f1f3f5] bg-[#121212] px-3 py-2 text-xs text-[#f1f3f5]"
              />
            </div>
          </SketchCard>
        </section>

        <aside className="flex flex-col gap-4">
          <SketchCard className="space-y-3">
            <h2 className="border-b border-[#f1f3f5] pb-2 text-sm tracking-wider">
              PRÓXIMAS AGENDAS
            </h2>
            {events.length === 0 ? (
              <EmptyState
                title="SEM AGENDAS PRÓXIMAS"
                description="NENHUM EVENTO OU PRAZO PROJETADO."
                accentColor="yellow"
              />
            ) : null}
          </SketchCard>

          <SketchCard className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#f1f3f5] pb-2">
              <h2 className="text-sm tracking-wider">FINANÇAS RÁPIDAS</h2>
              <span className="text-sm text-[#b2f2bb]">
                SALDO: {formatCentsToBRL(0)}
              </span>
            </div>
            {bills.length === 0 ? (
              <EmptyState
                title="NENHUMA CONTA CADASTRADA"
                description="LISTAS FALTA PAGAR E PAGO VAZIAS."
                accentColor="green"
              />
            ) : null}
          </SketchCard>
        </aside>
      </div>
    </div>
  );
}
