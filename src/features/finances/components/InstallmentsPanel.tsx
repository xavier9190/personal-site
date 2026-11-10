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
    <aside className="flex flex-col space-y-3 lg:border-l-2 lg:border-[#f1f3f5] lg:pl-6">
      <h2 className="border-b border-[#f1f3f5] pb-2 text-base tracking-wider">PARCELAS A PAGAR</h2>

      <div className="flex flex-wrap gap-2">
        <SketchButton variant="outline" className="min-h-[36px] px-2 text-[10px]" onClick={onOpenBills}>
          CONTAS A PAGAR
        </SketchButton>
        <SketchButton variant="outline" className="min-h-[36px] px-2 text-[10px]" onClick={onOpenCards}>
          CARTÕES
        </SketchButton>
        <SketchButton variant="outline" className="min-h-[36px] px-2 text-[10px]" onClick={onOpenInstallment}>
          + PARCELA
        </SketchButton>
      </div>

      {plans.length === 0 ? (
        <EmptyState
          title="SEM PARCELAMENTOS ATIVOS"
          description="SUAS COMPRAS PARCELADAS APARECERÃO AQUI NO FORMATO N/TOTAL."
        />
      ) : (
        <ul className="space-y-2">
          {plans.map((plan) => (
            <li key={plan.id} className="space-y-1 border-2 border-[#f1f3f5] px-3 py-2">
              <p className="text-sm">{plan.headerText}</p>
              <p className="text-[10px] text-[#868e96]">{plan.subtitleText}</p>
              {plan.creditCardName && (
                <p className="text-[10px] text-[#868e96]">CARTÃO {plan.creditCardName}</p>
              )}
              <div className="flex gap-2 pt-1">
                <SketchButton
                  variant="outline"
                  className="min-h-[32px] px-2 text-[10px]"
                  disabled={pending}
                  onClick={() => startTransition(() => void advanceInstallmentAction(plan.id))}
                >
                  +1 PARCELA PAGA
                </SketchButton>
                <SketchButton
                  variant="ghost"
                  className="min-h-[32px] px-2 text-[10px]"
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
    </aside>
  );
}
