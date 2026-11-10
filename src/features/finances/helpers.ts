import { assertPureDate, toRecifeDateString } from '@/lib/dates';
import { formatCentsToBRL, sumCents } from '@/lib/currency';
import {
  PRESET_TRANSACTION_CATEGORIES,
  type BalanceSummary,
  type CreditCardRecord,
  type FinancePeriod,
  type InstallmentPlanRecord,
  type InstallmentPlanView,
  type PayableBillRecord,
  type TransactionFilters,
  type TransactionRecord,
} from './types';

export function getYearMonthPrefix(
  period: FinancePeriod,
  referenceDate?: string,
): string | null {
  if (period === 'ALL') return null;

  const ref = referenceDate ? referenceDate.trim() : toRecifeDateString();
  const [yearStr, monthStr] = assertPureDate(ref);
  let year = Number(yearStr);
  let month = Number(monthStr);

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

  return `${year}-${String(month).padStart(2, '0')}`;
}

export function filterTransactionsList(
  all: TransactionRecord[],
  filters?: TransactionFilters,
): TransactionRecord[] {
  const prefix = getYearMonthPrefix(filters?.period ?? 'ALL', filters?.referenceDate);
  const exactDate = filters?.date?.trim() || null;
  const category = filters?.category?.trim().toUpperCase() || null;

  return all
    .filter((tx) => {
      if (prefix && !tx.occurredAt.startsWith(prefix)) return false;
      if (exactDate && tx.occurredAt !== exactDate) return false;
      if (category && tx.category.toUpperCase() !== category) return false;
      return true;
    })
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function buildInstallmentView(
  plan: InstallmentPlanRecord,
  cardsById: Map<string, CreditCardRecord>,
): InstallmentPlanView {
  const remainingInstallments = Math.max(
    0,
    plan.totalInstallments - plan.paidInstallments,
  );
  const formattedAmount = formatCentsToBRL(plan.installmentAmountCents);
  const card = plan.creditCardId ? cardsById.get(plan.creditCardId) ?? null : null;

  return {
    ...plan,
    remainingInstallments,
    headerText: `${plan.description} ${plan.paidInstallments}/${plan.totalInstallments}`,
    subtitleText: `FALTAM ${remainingInstallments} DE ${formattedAmount}`,
    creditCardName: card?.name ?? null,
  };
}

export function buildCardDueDate(competenceMonth: string, dueDay: number): string {
  const [yStr, mStr] = competenceMonth.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const clampedDay = Math.min(Math.max(1, dueDay), maxDay);
  return `${yStr}-${mStr}-${String(clampedDay).padStart(2, '0')}`;
}

export function computeCardInstallmentsTotal(
  cardId: string,
  allPlans: InstallmentPlanRecord[],
): number {
  const activeForCard = allPlans.filter(
    (p) => p.creditCardId === cardId && p.paidInstallments < p.totalInstallments,
  );
  return sumCents(activeForCard.map((p) => p.installmentAmountCents));
}

export function computeStandaloneInstallmentsTotal(
  allPlans: InstallmentPlanRecord[],
): { totalCents: number; count: number } {
  const activeStandalone = allPlans.filter(
    (p) => !p.creditCardId && p.paidInstallments < p.totalInstallments,
  );
  return {
    totalCents: sumCents(activeStandalone.map((p) => p.installmentAmountCents)),
    count: activeStandalone.length,
  };
}

export function filterBillsByPrefix(
  bills: PayableBillRecord[],
  prefix: string | null,
): PayableBillRecord[] {
  return bills
    .filter((b) =>
      prefix ? b.competenceMonth === prefix || b.dueDate.startsWith(prefix) : true,
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function computeBalanceSummary(
  periodTxs: TransactionRecord[],
  pendingBills: PayableBillRecord[],
  allPlans: InstallmentPlanRecord[],
): BalanceSummary {
  const paidTxs = periodTxs.filter((tx) => tx.status === 'PAID');
  const incomeCents = sumCents(
    paidTxs.filter((t) => t.type === 'INCOME').map((t) => t.amountCents),
  );
  const expenseCents = sumCents(
    paidTxs.filter((t) => t.type === 'EXPENSE').map((t) => t.amountCents),
  );
  const balanceCents = incomeCents - expenseCents;
  const standalone = computeStandaloneInstallmentsTotal(allPlans);
  const toPayCents = sumCents(pendingBills.map((b) => b.amountCents)) + standalone.totalCents;

  return {
    incomeCents,
    expenseCents,
    balanceCents,
    toPayCents,
    pendingBillsCount: pendingBills.length + standalone.count,
    forecastCents: balanceCents - toPayCents,
  };
}

export function computeDashboardMeta(
  periodTxs: TransactionRecord[],
  allTxs: TransactionRecord[],
) {
  const distinctDates = Array.from(new Set(periodTxs.map((t) => t.occurredAt))).sort((a, b) =>
    b.localeCompare(a),
  );
  const distinctCategories = Array.from(
    new Set(periodTxs.map((t) => t.category.toUpperCase())),
  ).sort();
  const availableCategories = Array.from(
    new Set([...PRESET_TRANSACTION_CATEGORIES, ...allTxs.map((t) => t.category.toUpperCase())]),
  );
  return { distinctDates, distinctCategories, availableCategories };
}
