'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { formatCentsToBRL } from '@/lib/currency';
import { formatPureDateShortBR } from '@/lib/dates';
import type { CalendarItem } from '@/features/calendar/logic';
import type { PayableBillRecord } from '@/features/finances/types';
import { toggleHideBalanceAction } from '@/features/finances/actions';
import { EmptyState } from '@/components/sketch/EmptyState';

export interface ChatRightPanelProps {
  upcomingItems: CalendarItem[];
  balanceCents: number;
  initialHideBalance: boolean;
  pendingBills: PayableBillRecord[];
  paidBills: PayableBillRecord[];
  todayRecife: string;
}

function sourceLabel(source: CalendarItem['source']) {
  switch (source) {
    case 'EVENT':
      return '[AGENDA]';
    case 'ACADEMIC_MILESTONE':
      return '[MARCO]';
    case 'ACADEMIC_DELIVERY':
      return '[ENTREGA]';
    case 'FINANCE_BILL':
      return '[CONTA]';
    case 'SHOPPING_DELIVERY':
      return '[ENCOMENDA]';
    default:
      return '';
  }
}

export function ChatRightPanel({
  upcomingItems,
  balanceCents,
  initialHideBalance,
  pendingBills,
  paidBills,
  todayRecife,
}: ChatRightPanelProps) {
  const [hideBalance, setHideBalance] = useState(initialHideBalance);

  const handleToggleHide = async () => {
    setHideBalance((prev) => !prev);
    await toggleHideBalanceAction();
  };

  return (
    <aside className="hidden h-full w-80 shrink-0 flex-col border-l-2 border-[#f1f3f5] bg-[#121212] lg:flex xl:w-96">
      {/* Metade Superior: Próximas Agendas */}
      <div className="flex flex-1 flex-col overflow-hidden border-b-2 border-[#f1f3f5] p-4">
        <h2 className="mb-3 inline-block self-start border-b-2 border-[#f1f3f5] pb-1 text-base tracking-wider uppercase">
          PRÓXIMAS AGENDAS
        </h2>

        <div className="flex flex-1 flex-col overflow-y-auto pr-1">
          {upcomingItems.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                title="SEM AGENDAS PRÓXIMAS"
                description="NENHUM EVENTO OU PRAZO PROJETADO."
              />
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingItems.slice(0, 10).map((item) => (
                <div
                  key={item.key}
                  className="rounded border border-[#f1f3f5] bg-[#1e1e1e] p-2 text-xs sketch-shadow-sm"
                  style={{ borderLeftColor: item.color, borderLeftWidth: '4px' }}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-[#f1f3f5] truncate">{item.title}</span>
                    <span className="text-[10px] text-[#868e96] shrink-0">
                      {sourceLabel(item.source)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-[#ced4da]">
                    <span>
                      {item.date === todayRecife ? 'HOJE' : formatPureDateShortBR(item.date)}
                    </span>
                    {item.startTime && <span>• {item.startTime}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Metade Inferior: Finanças */}
      <div className="flex flex-1 flex-col overflow-hidden p-4">
        <h2 className="mb-3 inline-block self-start border-b-2 border-[#f1f3f5] pb-1 text-base tracking-wider uppercase">
          FINANÇAS
        </h2>

        {/* Linha de Saldo com botão de ocultar/revelar */}
        <div className="mb-3 flex items-center justify-between rounded border border-[#f1f3f5] bg-[#1e1e1e] px-3 py-2 text-sm sketch-shadow-sm">
          <span className="font-bold tracking-wider">
            SALDO:{' '}
            <span className={balanceCents < 0 ? 'text-[#ffc9c9]' : 'text-[#b2f2bb]'}>
              {hideBalance ? 'R$ ••••' : formatCentsToBRL(balanceCents)}
            </span>
          </span>
          <button
            type="button"
            onClick={handleToggleHide}
            aria-label={hideBalance ? 'EXIBIR SALDO' : 'OCULTAR SALDO'}
            className="text-[#f1f3f5] hover:opacity-80 transition-opacity"
          >
            {hideBalance ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
          {/* FALTA PAGAR */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-bold tracking-wider text-[#ffc9c9] uppercase">
                FALTA PAGAR ({pendingBills.length}):
              </span>
            </div>
            {pendingBills.length === 0 ? (
              <p className="border-b border-dashed border-[#868e96] py-2 text-xs text-[#868e96]">
                NENHUMA CONTA PENDENTE
              </p>
            ) : (
              <div className="space-y-1.5">
                {pendingBills.slice(0, 5).map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between border-b border-dashed border-[#495057] py-1 text-xs"
                  >
                    <div className="flex flex-col truncate pr-2">
                      <span className="text-[#f1f3f5] font-medium truncate">{b.title}</span>
                      <span className="text-[10px] text-[#868e96]">
                        VENCE {formatPureDateShortBR(b.dueDate)}
                      </span>
                    </div>
                    <span className="text-[#ffc9c9] font-bold shrink-0">
                      {hideBalance ? 'R$ ••••' : formatCentsToBRL(b.amountCents)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PAGO */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-bold tracking-wider text-[#b2f2bb] uppercase">
                PAGO ({paidBills.length}):
              </span>
            </div>
            {paidBills.length === 0 ? (
              <p className="border-b border-dashed border-[#868e96] py-2 text-xs text-[#868e96]">
                NENHUMA CONTA PAGA
              </p>
            ) : (
              <div className="space-y-1.5">
                {paidBills.slice(0, 5).map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between border-b border-dashed border-[#495057] py-1 text-xs"
                  >
                    <div className="flex flex-col truncate pr-2">
                      <span className="text-[#f1f3f5] font-medium truncate">{b.title}</span>
                      <span className="text-[10px] text-[#868e96]">
                        {b.paidAt ? `PAGO EM ${formatPureDateShortBR(b.paidAt)}` : 'PAGO'}
                      </span>
                    </div>
                    <span className="text-[#b2f2bb] font-bold shrink-0">
                      {hideBalance ? 'R$ ••••' : formatCentsToBRL(b.amountCents)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
