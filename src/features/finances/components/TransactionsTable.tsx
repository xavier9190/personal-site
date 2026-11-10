'use client';

import { Filter } from 'lucide-react';
import { SketchCard } from '@/components/sketch/SketchCard';
import { SketchButton } from '@/components/sketch/SketchButton';
import { EmptyState } from '@/components/sketch/EmptyState';
import { TransactionFlowIcon } from '@/components/sketch/TransactionFlowIcon';
import { formatCentsToBRL } from '@/lib/currency';
import { formatPureDateShortBR } from '@/lib/dates';
import type { TransactionRecord } from '../service';

export interface TransactionsTableProps {
  transactions: TransactionRecord[];
  distinctDates: string[];
  distinctCategories: string[];
  dateFilter: string;
  categoryFilter: string;
  onDateChange: (date: string) => void;
  onCategoryChange: (category: string) => void;
  onClearFilters: () => void;
  onCreateClick: () => void;
  onEditClick: (tx: TransactionRecord) => void;
}

export function TransactionsTable({
  transactions,
  distinctDates,
  distinctCategories,
  dateFilter,
  categoryFilter,
  onDateChange,
  onCategoryChange,
  onClearFilters,
  onCreateClick,
  onEditClick,
}: TransactionsTableProps) {
  const hasActiveFilters = Boolean(dateFilter || categoryFilter);

  return (
    <section className="flex flex-col space-y-4 lg:col-span-2">
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-5 w-5 text-[#f1f3f5]" aria-hidden="true" />
        <span className="text-[#868e96]">|</span>

        <select
          aria-label="FILTRAR POR DATA"
          value={dateFilter}
          onChange={(e) => onDateChange(e.target.value)}
          className="rounded-md border-2 border-[#f1f3f5] bg-[#121212] px-2.5 py-1 text-xs text-[#f1f3f5] uppercase focus:outline-none"
        >
          <option value="">DATA V</option>
          {distinctDates.map((d) => (
            <option key={d} value={d}>
              {formatPureDateShortBR(d)} ({d})
            </option>
          ))}
        </select>

        <span className="text-[#868e96]">|</span>

        <select
          aria-label="FILTRAR POR CATEGORIA"
          value={categoryFilter}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="rounded-md border-2 border-[#f1f3f5] bg-[#121212] px-2.5 py-1 text-xs text-[#f1f3f5] uppercase focus:outline-none"
        >
          <option value="">CATEG V</option>
          {distinctCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {hasActiveFilters && (
          <SketchButton
            variant="ghost"
            onClick={onClearFilters}
            className="min-h-[32px] px-2 py-1 text-xs"
          >
            LIMPAR FILTROS
          </SketchButton>
        )}
      </div>

      <SketchCard className="flex flex-1 flex-col space-y-3">
        <h2 className="text-base tracking-wider">ÚLTIMAS TRANSAÇÕES</h2>

        <div className="grid grid-cols-12 items-center border-b-2 border-[#f1f3f5] pb-2 text-xs text-[#f1f3f5]">
          <span className="col-span-3">DATA</span>
          <span className="col-span-4 border-l border-[#f1f3f5] pl-2">DESC</span>
          <span className="col-span-3 border-l border-[#f1f3f5] pl-2">CATEG</span>
          <span className="col-span-2 border-l border-[#f1f3f5] pl-2 text-right">
            VALOR
          </span>
        </div>

        {transactions.length === 0 ? (
          hasActiveFilters ? (
            <EmptyState
              title="NENHUMA TRANSAÇÃO ENCONTRADA PARA ESTE FILTRO"
              description="LIMPE OS SELETORES DE DATA OU CATEGORIA PARA VER TODAS AS TRANSAÇÕES DO PERÍODO."
              actionLabel="LIMPAR FILTROS"
              onAction={onClearFilters}
            />
          ) : (
            <EmptyState
              title="NENHUMA TRANSAÇÃO REGISTRADA"
              description="ADICIONE SUA PRIMEIRA ENTRADA OU SAÍDA PARA INICIAR SEU FLUXO DE CAIXA."
              actionLabel="+ ADICIONAR"
              onAction={onCreateClick}
            />
          )
        ) : (
          <div className="flex flex-col gap-2">
            {transactions.map((tx) => (
              <button
                key={tx.id}
                type="button"
                onClick={() => onEditClick(tx)}
                className="grid w-full grid-cols-12 items-center rounded-md border-2 border-[#f1f3f5] bg-[#121212] px-3 py-2 text-left text-xs text-[#f1f3f5] transition-all hover:border-dashed"
              >
                <span className="col-span-3 flex items-center gap-2">
                  <TransactionFlowIcon type={tx.type} />
                  <span>{formatPureDateShortBR(tx.occurredAt)}</span>
                </span>
                <span className="col-span-4 truncate pl-2">{tx.description}</span>
                <span className="col-span-3 truncate pl-2">{tx.category}</span>
                <span className="col-span-2 pl-2 text-right">
                  {formatCentsToBRL(tx.amountCents)}
                </span>
              </button>
            ))}
          </div>
        )}
      </SketchCard>
    </section>
  );
}
