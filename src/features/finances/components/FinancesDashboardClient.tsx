'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { SketchButton } from '@/components/sketch/SketchButton';
import { cn } from '@/lib/utils';
import type {
  FinancePeriod,
  FinancesDashboardView,
  PayableBillRecord,
  TransactionRecord,
} from '../service';
import { FinanceKpiCards } from './FinanceKpiCards';
import { TransactionsTable } from './TransactionsTable';
import { TransactionModal } from './TransactionModal';
import { InstallmentsPanel } from './InstallmentsPanel';
import { FixedBillsSection } from './FixedBillsSection';
import { BillsModal } from './BillsModal';
import { CreditCardsModal } from './CreditCardsModal';
import { InstallmentModal } from './InstallmentModal';

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
  const [mobileTab, setMobileTab] = useState<'TX' | 'INST'>('TX');
  const [billsOpen, setBillsOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<PayableBillRecord | null>(null);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [installmentOpen, setInstallmentOpen] = useState(false);

  function openBillsWithItem(bill?: PayableBillRecord) {
    setEditingBill(bill ?? null);
    setBillsOpen(true);
  }

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

  const periodControl = (
    <div className="flex items-center">
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
        className="min-h-[44px] rounded-md border-2 border-[#f1f3f5] bg-[#121212] px-3 py-1.5 text-xs tracking-wider text-[#f1f3f5] uppercase focus:outline-none"
      >
        {(Object.keys(PERIOD_LABELS) as FinancePeriod[]).map((key) => (
          <option key={key} value={key}>
            {PERIOD_LABELS[key]}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6 md:h-full md:overflow-hidden">
      <PageHeader
        moduleId="finances"
        onAddClick={openCreateModal}
        titleSuffix={periodControl}
      />

      <div className="shrink-0">
        <FinanceKpiCards
          balanceCents={view.summary.balanceCents}
          toPayCents={view.summary.toPayCents}
          pendingBillsCount={view.summary.pendingBillsCount}
          forecastCents={view.summary.forecastCents}
          initialHideBalance={view.hideBalance}
          onOpenBills={() => openBillsWithItem()}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 lg:hidden shrink-0" role="tablist">
        <SketchButton
          variant={mobileTab === 'TX' ? 'filled' : 'outline'}
          onClick={() => setMobileTab('TX')}
        >
          ÚLTIMAS TRANSAÇÕES
        </SketchButton>
        <SketchButton
          variant={mobileTab === 'INST' ? 'filled' : 'outline'}
          onClick={() => setMobileTab('INST')}
        >
          PARCELAS A PAGAR
        </SketchButton>
      </div>

      <div className="flex flex-1 flex-col lg:flex-row gap-6 border-t-2 border-[#f1f3f5] pt-4 min-h-0 overflow-hidden">
        <div className={cn('flex flex-1 min-h-0 lg:w-3/5 xl:w-2/3', mobileTab === 'INST' && 'hidden lg:flex')}>
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
        </div>

        <div
          className={cn(
            'flex flex-1 flex-col min-h-0 lg:w-2/5 xl:w-1/3 lg:border-l-2 lg:border-[#f1f3f5] lg:pl-6 gap-3',
            mobileTab === 'TX' && 'hidden lg:flex',
          )}
        >
          <InstallmentsPanel
            plans={view.installmentPlans}
            onOpenBills={() => openBillsWithItem()}
            onOpenCards={() => setCardsOpen(true)}
            onOpenInstallment={() => setInstallmentOpen(true)}
          />
          <FixedBillsSection
            bills={view.payableBills}
            onOpenBills={() => openBillsWithItem()}
            onEditBill={(bill) => openBillsWithItem(bill)}
          />
        </div>
      </div>

      <BillsModal
        isOpen={billsOpen}
        onClose={() => {
          setBillsOpen(false);
          setEditingBill(null);
        }}
        bills={view.payableBills}
        availableCategories={view.availableCategories}
        initialEditingBill={editingBill}
      />
      <CreditCardsModal
        isOpen={cardsOpen}
        onClose={() => setCardsOpen(false)}
        cards={view.creditCards}
      />
      <InstallmentModal
        isOpen={installmentOpen}
        onClose={() => setInstallmentOpen(false)}
        cards={view.creditCards}
        availableCategories={view.availableCategories}
      />

      <TransactionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        initialTransaction={editingTx}
        availableCategories={view.availableCategories}
      />
    </div>
  );
}
