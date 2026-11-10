import { EyeOff, Mic, Paperclip } from 'lucide-react';
import { ChatService } from '@/features/chat/service';
import { CalendarService } from '@/features/calendar/service';
import { FinancesService } from '@/features/finances/service';
import { EmptyState } from '@/components/sketch/EmptyState';
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
    <div className="flex min-h-[calc(100vh-4rem)] flex-1 flex-col lg:h-full lg:min-h-0 lg:flex-row">
      {/* Coluna Central: Conversa do Chat preenchendo até o fim da tela */}
      <section className="flex flex-1 flex-col justify-between p-4 md:p-5 lg:h-full">
        <div>
          <h1 className="inline-block border-b-2 border-[#f1f3f5] pb-1 text-xl tracking-wider text-[#f1f3f5] uppercase md:text-2xl">
            CHAT
          </h1>
        </div>

        <div className="my-4 flex flex-1 flex-col justify-center overflow-y-auto">
          {messages.length === 0 ? (
            <EmptyState
              title="NENHUMA MENSAGEM NESTA CONVERSA"
              description="ENVIE UM COMANDO PARA LER, ADICIONAR, EDITAR OU EXCLUIR DADOS EM CALENDÁRIO, FINANÇAS, ACADÊMICO E COMPRAS."
            />
          ) : null}
        </div>

        {/* Barra inferior de mensagem com linha divisória, clipe (anexo) e microfone (voz) */}
        <div className="border-t-2 border-[#f1f3f5] pt-4">
          <div className="flex items-center gap-3 rounded-lg border-2 border-[#f1f3f5] bg-[#121212] px-3 py-2.5">
            <button
              type="button"
              aria-label="ANEXAR ARQUIVO"
              className="flex h-8 w-8 shrink-0 items-center justify-center text-[#f1f3f5] hover:opacity-80"
            >
              <Paperclip className="h-5 w-5" />
            </button>

            <span aria-hidden="true" className="h-5 w-[2px] bg-[#f1f3f5]" />

            <input
              type="text"
              readOnly
              placeholder="DIGITE SUA MENSAGEM"
              className="flex-1 bg-transparent text-sm tracking-wider text-[#f1f3f5] placeholder:text-[#868e96] focus:outline-none"
            />

            <button
              type="button"
              aria-label="DITAR POR VOZ"
              className="flex h-8 w-8 shrink-0 items-center justify-center text-[#f1f3f5] hover:opacity-80"
            >
              <Mic className="h-5 w-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Linha vertical separando o Chat de Próximas Agendas e Finanças */}
      <aside className="flex w-full shrink-0 flex-col border-t-2 border-[#f1f3f5] lg:h-full lg:w-80 lg:border-t-0 lg:border-l-2">
        {/* Metade Superior: Próximas Agendas preenchendo até a divisória */}
        <div className="flex flex-1 flex-col p-4">
          <h2 className="mb-3 inline-block self-start border-b-2 border-[#f1f3f5] pb-1 text-base tracking-wider uppercase">
            PRÓXIMAS AGENDAS
          </h2>
          <div className="flex flex-1 flex-col justify-center">
            {events.length === 0 ? (
              <EmptyState
                title="SEM AGENDAS PRÓXIMAS"
                description="NENHUM EVENTO OU PRAZO PROJETADO."
              />
            ) : null}
          </div>
        </div>

        {/* Linha horizontal separando Próximas Agendas de Finanças */}
        <div className="flex flex-1 flex-col border-t-2 border-[#f1f3f5] p-4">
          <h2 className="mb-3 inline-block self-start border-b-2 border-[#f1f3f5] pb-1 text-base tracking-wider uppercase">
            FINANÇAS
          </h2>

          <div className="mb-4 flex items-center justify-between text-sm">
            <span>SALDO: {formatCentsToBRL(0)}</span>
            <button
              type="button"
              aria-label="OCULTAR OU EXIBIR SALDO"
              className="text-[#f1f3f5] hover:opacity-80"
            >
              <EyeOff className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-1 flex-col justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs tracking-wider uppercase">FALTA PAGAR:</span>
              {bills.length === 0 && (
                <p className="border-b border-dashed border-[#868e96] py-2 text-xs text-[#868e96]">
                  NENHUMA CONTA PENDENTE
                </p>
              )}
            </div>

            <div className="space-y-1">
              <span className="text-xs tracking-wider uppercase">PAGO:</span>
              {bills.length === 0 && (
                <p className="border-b border-dashed border-[#868e96] py-2 text-xs text-[#868e96]">
                  NENHUMA CONTA PAGA
                </p>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
