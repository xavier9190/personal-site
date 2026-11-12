'use client';

import { useTransition } from 'react';
import { Check, X } from 'lucide-react';
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
    <section className="flex flex-1 min-h-0 flex-col gap-3 border-t-2 border-[#f1f3f5] pt-4">
      <div className="flex items-center justify-between border-b-2 border-[#f1f3f5] pb-1.5 shrink-0">
        <h2 className="text-sm md:text-base font-semibold tracking-wider text-[#f1f3f5]">
          CONTAS FIXAS
        </h2>
        <button
          type="button"
          onClick={onOpenBills}
          className="rounded-md border-2 border-[#f1f3f5] bg-[#121212] px-3 py-1.5 text-xs text-[#f1f3f5] hover:bg-[#f1f3f5] hover:text-[#121212] transition-colors uppercase tracking-wider font-semibold"
        >
          + CONTA
        </button>
      </div>

      {fixed.length === 0 ? (
        <button
          type="button"
          onClick={onOpenBills}
          className="text-xs text-[#868e96] underline text-left pt-2 uppercase"
        >
          NENHUMA CONTA FIXA. CLIQUE PARA CADASTRAR EM CONTAS A PAGAR.
        </button>
      ) : (
        <ul className="flex-1 min-h-0 space-y-2.5 overflow-y-auto pr-1">
          {fixed.map((bill) => {
            const paid = bill.status === 'PAID';
            return (
              <li
                key={bill.id}
                className="flex items-center justify-between gap-3 rounded-2xl border-2 border-[#f1f3f5] bg-[#121212] p-4 text-left transition-colors hover:border-[#868e96]"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm md:text-base font-semibold tracking-wide text-[#f1f3f5] truncate uppercase">
                    {bill.title}
                  </p>
                  <p className="text-xs md:text-sm text-[#f1f3f5] mt-1 tracking-wide uppercase font-normal">
                    {formatCentsToBRL(bill.amountCents)}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={paid ? 'PAGA — MARCAR COMO PENDENTE' : 'PENDENTE — MARCAR COMO PAGA'}
                  title={paid ? 'PAGA — CLIQUE PARA DESMARCAR' : 'PENDENTE — CLIQUE PARA MARCAR COMO PAGA'}
                  disabled={pending}
                  onClick={() =>
                    startTransition(() => void togglePayableBillStatusAction(bill.id, !paid))
                  }
                  className="flex h-11 w-11 md:h-12 md:w-12 items-center justify-center rounded-full border-2 border-[#f1f3f5] bg-[#121212] hover:bg-[#1e1e1e] transition-colors shrink-0"
                >
                  {paid ? (
                    <Check className="h-6 w-6 stroke-[2.5] text-[#f1f3f5]" />
                  ) : (
                    <X className="h-6 w-6 stroke-[2.5] text-[#f1f3f5]" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
