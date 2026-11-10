'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SketchAddButton } from '@/components/sketch/SketchAddButton';
import { EmptyState } from '@/components/sketch/EmptyState';
import type {
  FinancePeriod,
  FinancesDashboardView,
  TransactionRecord,
} from '../service';
import { FinanceKpiCards } from './FinanceKpiCards';
import { TransactionsTable } from './TransactionsTable';
import { TransactionModal } from './TransactionModal';

export interface FinancesDashboardClientProps {
  view: FinancesDashboardView;
}

const PERIOD_LABELS: Record<FinancePeriod, string> = {
  THIS_MONTH: 'ESTE MÊS',
  LAST_MONTH: 'MÊS PASSADO',
  NEXT_MONTH: 'PRÓXIMO MÊS',
  ALL: 'TODOS',
};

export function FinancesDashboardClient({ view }: FinancesDashboardClientProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<TransactionRecord | null>(null);

  function updateQuery(next: {
    period?: FinancePeriod;
    date?: string;
    category?: string;
  }) {
    const params = new URLSearchParams();
    const period = next.period ?? view.period;
    const date = next.date !== undefined ? next.date : view.dateFilter;
    const category = next.category !== undefined ? next.category : view.categoryFilter;

    if (period && period !== 'THIS_MONTH') {
      params.set('period', period);
    }
    if (date) {
      params.set('date', date);
    }
    if (category) {
      params.set('category', category);
    }

    const qs = params.toString();
    router.push(qs ? `/financas?${qs}` : '/financas');
  }

  function openCreateModal() {
    setEditingTx(null);
    setModalOpen(true);
  }

  function openEditModal(tx: TransactionRecord) {
    setEditingTx(tx);
    setModalOpen(true);
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
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
            value={view.period}
            onChange={(e) =>
              updateQuery({
                period: e.target.value as FinancePeriod,
                date: '',
                category: '',
              })
            }
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

      <FinanceKpiCards
        balanceCents={view.summary.balanceCents}
        initialHideBalance={view.hideBalance}
      />

      <div className="grid flex-1 grid-cols-1 gap-6 border-t-2 border-[#f1f3f5] pt-4 lg:grid-cols-3">
        <TransactionsTable
          transactions={view.transactions}
          distinctDates={view.distinctDates}
          distinctCategories={view.distinctCategories}
          dateFilter={view.dateFilter}
          categoryFilter={view.categoryFilter}
          onDateChange={(date) => updateQuery({ date })}
          onCategoryChange={(category) => updateQuery({ category })}
          onClearFilters={() => updateQuery({ date: '', category: '' })}
          onCreateClick={openCreateModal}
          onEditClick={openEditModal}
        />

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
