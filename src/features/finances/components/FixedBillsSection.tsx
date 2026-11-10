'use client';

import { useTransition } from 'react';
import { Check, X } from 'lucide-react';
import { SketchButton } from '@/components/sketch/SketchButton';
import { formatCentsToBRL } from '@/lib/currency';
import type { PayableBillRecord } from '../service';
import { togglePayableBillStatusAction } from '../bill-actions';

export interface FixedBillsSectionProps {
  bills: PayableBillRecord[];
  onOpenBills: () => void;
}

export function FixedBillsSection({ bills, onOpenBills }: FixedBillsSectionProps) {
  const [pending, startTransition] = useTransition();
  const fixed = bills.filter((b) => b.billType === 'FIXED_RECURRING');

  return (
    <section className="flex flex-1 min-h-0 flex-col gap-2 border-t-2 border-[#f1f3f5] pt-3">
      <h2 className="border-b border-[#f1f3f5] pb-1 text-sm md:text-base tracking-wider shrink-0">
        CONTAS FIXAS
      </h2>
      {fixed.length === 0 ? (
        <button
          type="button"
          onClick={onOpenBills}
          className="text-[10px] text-[#868e96] underline text-left"
        >
          NENHUMA CONTA FIXA. CLIQUE PARA CADASTRAR EM CONTAS A PAGAR.
        </button>
      ) : (
        <ul className="flex-1 min-h-0 space-y-2 overflow-y-auto pr-1">
          {fixed.map((bill) => {
            const paid = bill.status === 'PAID';
            return (
              <li
                key={bill.id}
                className="flex items-center justify-between gap-3 rounded-xl border-2 border-[#f1f3f5] bg-[#121212] p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium tracking-wide text-[#f1f3f5] truncate">{bill.title}</p>
                  <p className="text-xs text-[#f1f3f5] mt-0.5">{formatCentsToBRL(bill.amountCents)}</p>
                  <p className="text-[10px] text-[#868e96] mt-0.5">VENCE {bill.dueDate}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!paid && (
                    <SketchButton
                      variant="outline"
                      className="min-h-[32px] h-8 px-2 text-[10px]"
                      disabled={pending}
                      onClick={() =>
                        startTransition(() => void togglePayableBillStatusAction(bill.id, true))
                      }
                    >
                      PAGUEI
                    </SketchButton>
                  )}
                  <button
                    type="button"
                    aria-label={paid ? 'PAGA — MARCAR COMO PENDENTE' : 'PENDENTE — MARCAR COMO PAGA'}
                    disabled={pending}
                    onClick={() =>
                      startTransition(() => void togglePayableBillStatusAction(bill.id, !paid))
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#f1f3f5] bg-[#121212] hover:bg-[#1e1e1e] transition-colors"
                  >
                    {paid ? <Check className="h-6 w-6 stroke-[2.5]" /> : <X className="h-6 w-6 stroke-[2.5]" />}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
