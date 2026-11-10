'use client';

import { useState, useTransition } from 'react';
import { Eye, EyeOff, Filter } from 'lucide-react';
import { SketchCard } from '@/components/sketch/SketchCard';
import { SketchButton } from '@/components/sketch/SketchButton';
import { SketchAddButton } from '@/components/sketch/SketchAddButton';
import { EmptyState } from '@/components/sketch/EmptyState';
import { TransactionFlowIcon } from '@/components/sketch/TransactionFlowIcon';
import { formatCentsToBRL, maskBRLValue } from '@/lib/currency';
import { formatPureDateShortBR } from '@/lib/dates';
import type { FinancePeriod } from '../service';
import { toggleHideBalanceAction } from '../actions';
import {
  TransactionModal,
  type EditableTransaction,
} from './TransactionModal';

export interface FinancesDashboardClientProps {
  initialTransactions: EditableTransaction[];
  initialHideBalance: boolean;
  referenceDate: string;
}

const PERIOD_LABELS: Record<FinancePeriod, string> = {
  THIS_MONTH: 'ESTE MÊS',
  LAST_MONTH: 'MÊS PASSADO',
  NEXT_MONTH: 'PRÓXIMO MÊS',
  ALL: 'TODOS',
};

function matchesPeriod(
  occurredAt: string,
  period: FinancePeriod,
  referenceDate: string,
): boolean {
  if (period === 'ALL') return true;
  const [yStr, mStr] = referenceDate.split('-');
  let year = Number(yStr);
  let month = Number(mStr);

  if (period === 'LAST_MONTH') {
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
  } else if (period === 'NEXT_MONTH') {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return occurredAt.startsWith(prefix);
}

export function FinancesDashboardClient({
  initialTransactions,
  initialHideBalance,
  referenceDate,
}: FinancesDashboardClientProps) {
  const [period, setPeriod] = useState<FinancePeriod>('THIS_MONTH');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [hideBalance, setHideBalance] = useState<boolean>(initialHideBalance);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<EditableTransaction | null>(null);
  const [isPending, startTransition] = useTransition();

  const periodTransactions = initialTransactions.filter((tx) =>
    matchesPeriod(tx.occurredAt, period, referenceDate),
  );

  const distinctDates = Array.from(
    new Set(periodTransactions.map((t) => t.occurredAt)),
  ).sort((a, b) => b.localeCompare(a));

  const distinctCategories = Array.from(
    new Set(periodTransactions.map((t) => t.category.toUpperCase())),
  ).sort();

  const filteredTransactions = periodTransactions
    .filter((tx) => {
      if (dateFilter && tx.occurredAt !== dateFilter) return false;
      if (categoryFilter && tx.category.toUpperCase() !== categoryFilter) return false;
      return true;
    })
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  const balanceCents = periodTransactions.reduce((acc, tx) => {
    return tx.type === 'INCOME' ? acc + tx.amountCents : acc - tx.amountCents;
  }, 0);

  function handleToggleBalance() {
    const nextVal = !hideBalance;
    setHideBalance(nextVal);
    startTransition(async () => {
      const res = await toggleHideBalanceAction();
      setHideBalance(res.hideBalance);
    });
  }

  function openCreateModal() {
    setEditingTx(null);
    setModalOpen(true);
  }

  function openEditModal(tx: EditableTransaction) {
    setEditingTx(tx);
    setModalOpen(true);
  }

  const hasActiveFilters = Boolean(dateFilter || categoryFilter);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      {/* Cabeçalho com Título, Filtro de Período (ESTE MÊS v) e botão padronizado + ADICIONAR */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6">
          <h1 className="inline-block border-b-2 border-[#f1f3f5] pb-1 text-xl tracking-wider text-[#f1f3f5] uppercase md:text-2xl">
            FINANÇAS
          </h1>

          <label className="sr-only" htmlFor="period-select">
            PERÍODO
          </label>
          <select
            id="period-select"
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value as FinancePeriod);
              setDateFilter('');
              setCategoryFilter('');
            }}
            className="min-h-[40px] rounded-md border-2 border-[#f1f3f5] bg-[#121212] px-3 py-1.5 text-xs tracking-wider text-[#f1f3f5] uppercase focus:outline-none"
          >
            {(Object.keys(PERIOD_LABELS) as FinancePeriod[]).map((key) => (
              <option key={key} value={key}>
                {PERIOD_LABELS[key]}
              </option>
            ))}
          </select>
        </div>

        <SketchAddButton onClick={openCreateModal} />
      </header>

      {/* 3 Cards de Resumo (Saldo com ícone de olho, A Pagar, Previsto) */}
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
          <p className="text-center text-xl text-[#f1f3f5]">
            {maskBRLValue(balanceCents, hideBalance)}
          </p>
        </SketchCard>

        <SketchCard className="space-y-1">
          <span className="text-xs text-[#f1f3f5]">A PAGAR</span>
          <p className="text-center text-xl text-[#f1f3f5]">
            {maskBRLValue(0, hideBalance)}
          </p>
          <p className="text-center text-[10px] text-[#868e96]">FALTAM 0 CONTAS</p>
        </SketchCard>

        <SketchCard className="space-y-2">
          <span className="text-xs text-[#f1f3f5]">PREVISTO</span>
          <p className="text-center text-xl text-[#f1f3f5]">
            {maskBRLValue(balanceCents, hideBalance)}
          </p>
        </SketchCard>
      </section>

      {/* Área Principal: Filtros (Funil | Data v | Categ v) + Tabela Últimas Transações | Parcelas a Pagar */}
      <div className="grid flex-1 grid-cols-1 gap-6 border-t-2 border-[#f1f3f5] pt-4 lg:grid-cols-3">
        <section className="flex flex-col space-y-4 lg:col-span-2">
          {/* Barra de Filtros: Funil | DATA v | CATEG v */}
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="h-5 w-5 text-[#f1f3f5]" aria-hidden="true" />
            <span className="text-[#868e96]">|</span>

            <select
              aria-label="FILTRAR POR DATA"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
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
              onChange={(e) => setCategoryFilter(e.target.value)}
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
                onClick={() => {
                  setDateFilter('');
                  setCategoryFilter('');
                }}
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

            {filteredTransactions.length === 0 ? (
              hasActiveFilters ? (
                <EmptyState
                  title="NENHUMA TRANSAÇÃO ENCONTRADA PARA ESTE FILTRO"
                  description="LIMPE OS SELETORES DE DATA OU CATEGORIA PARA VER TODAS AS TRANSAÇÕES DO PERÍODO."
                  actionLabel="LIMPAR FILTROS"
                  onAction={() => {
                    setDateFilter('');
                    setCategoryFilter('');
                  }}
                />
              ) : (
                <EmptyState
                  title="NENHUMA TRANSAÇÃO REGISTRADA"
                  description="ADICIONE SUA PRIMEIRA ENTRADA OU SAÍDA PARA INICIAR SEU FLUXO DE CAIXA."
                  actionLabel="+ ADICIONAR"
                  onAction={openCreateModal}
                />
              )
            ) : (
              <div className="flex flex-col gap-2">
                {filteredTransactions.map((tx) => (
                  <button
                    key={tx.id}
                    type="button"
                    onClick={() => openEditModal(tx)}
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

        <aside className="flex flex-col space-y-3 lg:border-l-2 lg:border-[#f1f3f5] lg:pl-6">
          <h2 className="border-b border-[#f1f3f5] pb-2 text-base tracking-wider">
            PARCELAS A PAGAR
          </h2>
          <EmptyState
            title="SEM PARCELAMENTOS ATIVOS"
            description="SUAS COMPRAS PARCELADAS APARECERÃO AQUI NO FORMATO N/TOTAL."
          />
        </aside>
      </div>

      <TransactionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        initialTransaction={editingTx}
      />
    </div>
  );
}
