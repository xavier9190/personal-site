'use client';

import { useTransition } from 'react';
import { SketchButton } from '@/components/sketch/SketchButton';
import { EmptyState } from '@/components/sketch/EmptyState';
import type { InstallmentPlanView } from '../service';
import { advanceInstallmentAction, deleteInstallmentPlanAction } from '../bill-actions';

export interface InstallmentsPanelProps {
  plans: InstallmentPlanView[];
  onOpenBills: () => void;
  onOpenCards: () => void;
  onOpenInstallment: () => void;
}

export function InstallmentsPanel({
  plans,
  onOpenBills,
  onOpenCards,
  onOpenInstallment,
}: InstallmentsPanelProps) {
  const [pending, startTransition] = useTransition();

  return (
    <section className="flex flex-1 min-h-0 flex-col gap-2">
      <h2 className="border-b border-[#f1f3f5] pb-1 text-sm md:text-base tracking-wider shrink-0">
        PARCELAS A PAGAR
      </h2>

      <div className="flex flex-wrap gap-2 shrink-0">
        <SketchButton variant="outline" className="min-h-[32px] h-8 px-2 text-[10px]" onClick={onOpenBills}>
          CONTAS A PAGAR
        </SketchButton>
        <SketchButton variant="outline" className="min-h-[32px] h-8 px-2 text-[10px]" onClick={onOpenCards}>
          CARTÕES
        </SketchButton>
        <SketchButton variant="outline" className="min-h-[32px] h-8 px-2 text-[10px]" onClick={onOpenInstallment}>
          + PARCELA
        </SketchButton>
      </div>

      {plans.length === 0 ? (
        <EmptyState
          title="SEM PARCELAMENTOS ATIVOS"
          description="SUAS COMPRAS PARCELADAS APARECERÃO AQUI NO FORMATO N/TOTAL."
        />
      ) : (
        <ul className="flex-1 min-h-0 space-y-2 overflow-y-auto pr-1">
          {plans.map((plan) => (
            <li
              key={plan.id}
              className="space-y-1.5 rounded-xl border-2 border-[#f1f3f5] bg-[#121212] p-3 text-left"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium tracking-wide text-[#f1f3f5] truncate">
                  {plan.description}
                </span>
                <span className="text-sm font-medium tracking-wide text-[#f1f3f5] shrink-0">
                  {plan.paidInstallments}/{plan.totalInstallments}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-[#f1f3f5]">
                  {plan.subtitleText}
                </span>
                {plan.creditCardName && (
                  <span className="text-[10px] text-[#868e96] border border-[#868e96] rounded px-1 shrink-0">
                    {plan.creditCardName}
                  </span>
                )}
              </div>
              <div className="flex gap-2 pt-1 border-t border-[#f1f3f5]/20 mt-1">
                <SketchButton
                  variant="outline"
                  className="min-h-[28px] h-7 px-2 text-[10px]"
                  disabled={pending}
                  onClick={() => startTransition(() => void advanceInstallmentAction(plan.id))}
                >
                  +1 PARCELA PAGA
                </SketchButton>
                <SketchButton
                  variant="ghost"
                  className="min-h-[28px] h-7 px-2 text-[10px]"
                  disabled={pending}
                  onClick={() => startTransition(() => void deleteInstallmentPlanAction(plan.id))}
                >
                  X
                </SketchButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
