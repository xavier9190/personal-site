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
    <section className="space-y-3 border-t-2 border-[#f1f3f5] pt-3">
      <h2 className="text-base tracking-wider">CONTAS FIXAS</h2>
      {fixed.length === 0 ? (
        <button
          type="button"
          onClick={onOpenBills}
          className="text-[10px] text-[#868e96] underline"
        >
          NENHUMA CONTA FIXA. CLIQUE PARA CADASTRAR EM CONTAS A PAGAR.
        </button>
      ) : (
        <ul className="space-y-2">
          {fixed.map((bill) => {
            const paid = bill.status === 'PAID';
            return (
              <li
                key={bill.id}
                className="flex items-center justify-between gap-2 rounded-md border-2 border-[#f1f3f5] px-3 py-2"
              >
                <div>
                  <p className="text-sm">{bill.title}</p>
                  <p className="text-xs">{formatCentsToBRL(bill.amountCents)}</p>
                  <p className="text-[10px] text-[#868e96]">VENCE {bill.dueDate}</p>
                </div>
                <div className="flex items-center gap-2">
                  {!paid && (
                    <SketchButton
                      variant="outline"
                      className="min-h-[32px] px-2 text-[10px]"
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
                    aria-label={paid ? 'PAGA — MARCAR COMO PENDENTE' : 'PENDENTE'}
                    disabled={pending || !paid}
                    onClick={() =>
                      startTransition(() => void togglePayableBillStatusAction(bill.id, false))
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#f1f3f5]"
                  >
                    {paid ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
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
