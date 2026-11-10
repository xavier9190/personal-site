'use client';

import { useState, useTransition } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { SketchCard } from '@/components/sketch/SketchCard';
import { formatCentsToBRL, maskBRLValue } from '@/lib/currency';
import { toggleHideBalanceAction } from '../actions';

export interface FinanceKpiCardsProps {
  balanceCents: number;
  toPayCents: number;
  pendingBillsCount: number;
  forecastCents: number;
  initialHideBalance: boolean;
}

export function FinanceKpiCards({
  balanceCents,
  toPayCents,
  pendingBillsCount,
  forecastCents,
  initialHideBalance,
}: FinanceKpiCardsProps) {
  const [hideBalance, setHideBalance] = useState<boolean>(initialHideBalance);
  const [isPending, startTransition] = useTransition();

  function handleToggleBalance() {
    setHideBalance((prev) => !prev);
    startTransition(async () => {
      const res = await toggleHideBalanceAction();
      setHideBalance(res.hideBalance);
    });
  }

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <SketchCard className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#f1f3f5]">SALDO</span>
          <button
            type="button"
            onClick={handleToggleBalance}
            disabled={isPending}
            aria-label="OCULTAR OU EXIBIR SALDO"
            className="text-[#f1f3f5] hover:opacity-80"
          >
            {hideBalance ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="text-center text-xl text-[#f1f3f5]" data-testid="saldo-value">
          {maskBRLValue(balanceCents, hideBalance)}
        </p>
      </SketchCard>

      <SketchCard className="space-y-1">
        <span className="text-xs text-[#f1f3f5]">A PAGAR</span>
        <p className="text-center text-xl text-[#f1f3f5]" data-testid="apagar-value">
          {formatCentsToBRL(toPayCents)}
        </p>
        <p className="text-center text-[10px] text-[#868e96]">
          {pendingBillsCount === 1 ? 'FALTA 1 CONTA' : `FALTAM ${pendingBillsCount} CONTAS`}
        </p>
      </SketchCard>

      <SketchCard className="space-y-2">
        <span className="text-xs text-[#f1f3f5]">PREVISTO</span>
        <p className="text-center text-xl text-[#f1f3f5]" data-testid="previsto-value">
          {maskBRLValue(forecastCents, hideBalance)}
        </p>
      </SketchCard>
    </section>
  );
}
