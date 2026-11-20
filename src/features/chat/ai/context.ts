import { APP_TIMEZONE, toRecifeDateString, toRecifeTimeHHMM } from '@/lib/dates';
import type { CalendarService } from '@/features/calendar/service';
import type { FinancesService } from '@/features/finances/service';
import { formatCentsToBRL } from '@/lib/currency';
import type { ActiveDraftContext, ChatContext } from './types';

export async function buildChatContext(
  calendarService?: CalendarService,
  financesService?: FinancesService,
  referenceDate: Date = new Date(),
  activeDraft: ActiveDraftContext | null = null,
): Promise<ChatContext> {
  const currentDateRecife = toRecifeDateString(referenceDate);
  const currentTimeRecife = toRecifeTimeHHMM(referenceDate);

  let summaryUpcomingEvents = 'NENHUMA AGENDA PRÓXIMA.';
  if (calendarService) {
    try {
      // 30 days window
      const futureDate = new Date(referenceDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      const toRecife = toRecifeDateString(futureDate);
      const items = await calendarService.listItems(currentDateRecife, toRecife);
      if (items.length > 0) {
        summaryUpcomingEvents = items
          .slice(0, 5)
          .map((i) => `• [${i.date}${i.startTime ? ' ' + i.startTime : ''}] ${i.title} (${i.source})`)
          .join('\n');
      }
    } catch {
      // ignore in test / memory setup if table not ready
    }
  }

  let summaryFinances = 'SALDO: R$ 0,00 | FALTA PAGAR: 0 CONTAS';
  if (financesService) {
    try {
      const summary = await financesService.getBalanceSummary();
      summaryFinances = `SALDO EFETIVO: ${formatCentsToBRL(summary.balanceCents)} | PREVISTO: ${formatCentsToBRL(summary.forecastCents)} | A PAGAR: ${formatCentsToBRL(summary.toPayCents)} (${summary.pendingBillsCount} CONTAS)`;
    } catch {
      // ignore
    }
  }

  const activeDraftBlock = activeDraft
    ? `\nRASCUNHO ATIVO EM ANDAMENTO (DRAFTING):
- FERRAMENTA: ${activeDraft.toolName} (${activeDraft.displayName})
- CAMPOS JÁ COLETADOS: ${JSON.stringify(activeDraft.collectedArgs)}
- CAMPOS OBRIGATÓRIOS FALTANDO: ${activeDraft.missingFields
        .map((f) => `${f.name} (${f.label}: ${f.description})`)
        .join(', ')}
REGRAS PARA O RASCUNHO ATIVO:
- SE O USUÁRIO INFORMAR OS DADOS FALTANDO, INVOQUE "${activeDraft.toolName}" COM OS NOVOS CAMPOS (E/OU OS JÁ COLETADOS).
- SE O USUÁRIO MUDAR DE ASSUNTO PARA OUTRA AÇÃO, INVOQUE A NOVA FERRAMENTA (O RASCUNHO ANTERIOR SERÁ CANCELADO AUTOMATICAMENTE).
`
    : '';

  const systemPrompt = `VOCÊ É O ASSISTENTE PESSOAL INTELIGENTE DO PERSONAL SITE.
FUSO HORÁRIO: ${APP_TIMEZONE}.
DATA ATUAL EM RECIFE: ${currentDateRecife}.
HORÁRIO ATUAL EM RECIFE: ${currentTimeRecife}.

DOMÍNIOS DISPONÍVEIS:
1. CALENDÁRIO: GERENCIA EVENTOS E PROJEÇÕES UNIFICADAS DE MARCOS ACADÊMICOS, CONTAS A PAGAR E ENTREGAS.
2. FINANÇAS: CONTROLA SALDO, TRANSAÇÕES (ENTRADAS E SAÍDAS), CONTAS A PAGAR, CARTÕES DE CRÉDITO E PARCELAMENTOS.
3. ACADÊMICO: GERENCIA PROJETOS DA FACULDADE, INTEGRANTES, LINKS E MARCOS COM SELO [OK].
4. COMPRAS: CONTROLA WISHLIST (QUERO COMPRAR) E ENCOMENDAS EM TRÂNSITO (JÁ COMPREI).

ESTADO ATUAL DO SISTEMA:
- PRÓXIMAS AGENDAS:
${summaryUpcomingEvents}
- FINANÇAS:
${summaryFinances}${activeDraftBlock}

DIRETRIZES DE RESPOSTA:
- RESPONDA SEMPRE DE FORMA CLARA, CONCISA E DIRETA EM PORTUGUÊS (PT-BR).
- MANTENHA A CONSISTÊNCIA COM O DESIGN SYSTEM SKETCH E O VOCABULÁRIO DO DOMÍNIO.
`;

  return {
    currentDateRecife,
    currentTimeRecife,
    timeZone: APP_TIMEZONE,
    summaryUpcomingEvents,
    summaryFinances,
    activeDraft,
    systemPrompt,
  };
}
