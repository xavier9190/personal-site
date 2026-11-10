import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TransactionFlowIconProps {
  type: 'INCOME' | 'EXPENSE';
  className?: string;
}

export function TransactionFlowIcon({ type, className }: TransactionFlowIconProps) {
  const isIncome = type === 'INCOME';

  return (
    <span
      aria-label={isIncome ? 'ENTRADA' : 'SAÍDA'}
      className={cn(
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-[#f1f3f5] text-[#121212]',
        isIncome ? 'bg-[#b2f2bb]' : 'bg-[#ffc9c9]',
        className,
      )}
    >
      {isIncome ? (
        <ArrowUp className="h-4 w-4 stroke-[2.5]" />
      ) : (
        <ArrowDown className="h-4 w-4 stroke-[2.5]" />
      )}
    </span>
  );
}
