'use client';

import { useState, useTransition } from 'react';
import { ConfirmDeleteModal } from '@/components/sketch/ConfirmDeleteModal';
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
  onOpenCards,
  onOpenInstallment,
}: InstallmentsPanelProps) {
  const [pending, startTransition] = useTransition();
  const [deletingPlan, setDeletingPlan] = useState<InstallmentPlanView | null>(null);

  return (
    <section className="flex flex-1 min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between border-b-2 border-[#f1f3f5] pb-1.5 shrink-0">
        <h2 className="text-sm md:text-base font-semibold tracking-wider text-[#f1f3f5]">
          PARCELAS A PAGAR
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenCards}
            className="text-[11px] text-[#868e96] hover:text-[#f1f3f5] transition-colors uppercase tracking-wider"
          >
            CARTÕES
          </button>
          <button
            type="button"
            onClick={onOpenInstallment}
            className="rounded-md border border-[#f1f3f5] px-2 py-0.5 text-[11px] text-[#f1f3f5] hover:bg-[#f1f3f5] hover:text-[#121212] transition-colors uppercase tracking-wider font-medium"
          >
            + PARCELA
          </button>
        </div>
      </div>

      {plans.length === 0 ? (
        <EmptyState
          title="SEM PARCELAMENTOS ATIVOS"
          description="SUAS COMPRAS PARCELADAS APARECERÃO AQUI NO FORMATO N/TOTAL."
        />
      ) : (
        <ul className="flex-1 min-h-0 space-y-2.5 overflow-y-auto pr-1">
          {plans.map((plan) => (
            <li
              key={plan.id}
              className="group relative flex flex-col justify-between rounded-2xl border-2 border-[#f1f3f5] bg-[#121212] p-4 text-left transition-colors hover:border-[#868e96]"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm md:text-base font-semibold tracking-wide text-[#f1f3f5] truncate uppercase">
                  {plan.description}
                </span>
                <button
                  type="button"
                  title="CLIQUE PARA AVANÇAR (+1 PARCELA PAGA)"
                  disabled={pending}
                  onClick={() => startTransition(() => void advanceInstallmentAction(plan.id))}
                  className="rounded-md border border-[#f1f3f5] px-2 py-0.5 text-xs font-semibold tracking-wider text-[#f1f3f5] hover:bg-[#f1f3f5] hover:text-[#121212] transition-colors shrink-0"
                >
                  {plan.paidInstallments}/{plan.totalInstallments}
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 mt-2">
                <span className="text-xs text-[#f1f3f5] tracking-wide uppercase">
                  {plan.subtitleText}
                </span>
                <div className="flex items-center gap-2">
                  {plan.creditCardName && (
                    <span className="text-[10px] text-[#868e96] border border-[#868e96] rounded px-1 shrink-0 uppercase">
                      {plan.creditCardName}
                    </span>
                  )}
                  <button
                    type="button"
                    title="EXCLUIR PARCELAMENTO"
                    disabled={pending}
                    onClick={() => setDeletingPlan(plan)}
                    className="opacity-0 group-hover:opacity-100 text-xs text-[#868e96] hover:text-[#ffc9c9] transition-opacity"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {deletingPlan && (
        <ConfirmDeleteModal
          isOpen={Boolean(deletingPlan)}
          onClose={() => setDeletingPlan(null)}
          onConfirm={() => {
            const id = deletingPlan.id;
            setDeletingPlan(null);
            startTransition(() => void deleteInstallmentPlanAction(id));
          }}
          itemDescription={`O PARCELAMENTO "${deletingPlan.description}"`}
          pending={pending}
        />
      )}
    </section>
  );
}
