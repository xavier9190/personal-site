'use client';

import { useState, useTransition } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { maskBRLValue } from '@/lib/currency';
import { toggleHideBalanceAction } from '../actions';

export interface BalanceQuickRowProps {
  balanceCents: number;
  initialHideBalance: boolean;
}

export function BalanceQuickRow({
  balanceCents,
  initialHideBalance,
}: BalanceQuickRowProps) {
  const [hideBalance, setHideBalance] = useState(initialHideBalance);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    setHideBalance((prev) => !prev);
    startTransition(async () => {
      const res = await toggleHideBalanceAction();
      setHideBalance(res.hideBalance);
    });
  }

  return (
    <div className="mb-4 flex items-center justify-between text-sm">
      <span>SALDO: {maskBRLValue(balanceCents, hideBalance)}</span>
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        aria-label="OCULTAR OU EXIBIR SALDO"
        className="text-[#f1f3f5] hover:opacity-80"
      >
        {hideBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
