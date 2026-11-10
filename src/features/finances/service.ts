import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { AppDatabase } from '@/db';
import { getDb } from '@/db';
import { assertPureDate, toRecifeDateString } from '@/lib/dates';
import { sumCents } from '@/lib/currency';
import * as schema from './schema';
import {
  createTransactionSchema,
  PRESET_TRANSACTION_CATEGORIES,
  updateTransactionSchema,
  type BalanceSummary,
  type CreateTransactionInput,
  type FinancePeriod,
  type FinancesDashboardView,
  type TransactionFilters,
  type TransactionRecord,
  type UpdateTransactionInput,
} from './types';

export * from './types';

const DEFAULT_PREF_ID = 'default';

function getYearMonthPrefix(period: FinancePeriod, referenceDate?: string): string | null {
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

export class FinancesService {
  constructor(private readonly db: AppDatabase = getDb()) {}

  createTransaction(input: CreateTransactionInput): TransactionRecord {
    const parsed = createTransactionSchema.parse(input);
    const record: TransactionRecord = {
      id: crypto.randomUUID(),
      type: parsed.type,
      description: parsed.description.toUpperCase(),
      category: parsed.category.toUpperCase(),
      amountCents: parsed.amountCents,
      occurredAt: parsed.occurredAt,
      status: parsed.status,
      payableBillId: null,
      shoppingItemId: null,
    };

    this.db.insert(schema.transactions).values(record).run();
    return record;
  }

  updateTransaction(id: string, input: UpdateTransactionInput): TransactionRecord {
    const existing = this.db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, id))
      .get();

    if (!existing) {
      throw new Error(`TRANSAÇÃO NÃO ENCONTRADA: ${id}`);
    }

    const parsed = updateTransactionSchema.parse(input);
    const updated: TransactionRecord = {
      ...existing,
      type: parsed.type ?? existing.type,
      description: parsed.description ? parsed.description.toUpperCase() : existing.description,
      category: parsed.category ? parsed.category.toUpperCase() : existing.category,
      amountCents: parsed.amountCents ?? existing.amountCents,
      occurredAt: parsed.occurredAt ?? existing.occurredAt,
      status: parsed.status ?? existing.status,
    };

    this.db.update(schema.transactions).set(updated).where(eq(schema.transactions.id, id)).run();
    return updated;
  }

  deleteTransaction(id: string): void {
    this.db.delete(schema.transactions).where(eq(schema.transactions.id, id)).run();
  }

  listTransactions(filters?: TransactionFilters): TransactionRecord[] {
    const all = this.db.select().from(schema.transactions).all();
    const period = filters?.period ?? 'ALL';
    const prefix = getYearMonthPrefix(period, filters?.referenceDate);
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

  listInstallmentPlans() {
    return this.db.select().from(schema.installmentPlans).all();
  }

  listPayableBills() {
    return this.db.select().from(schema.payableBills).all();
  }

  getBalanceSummary(params?: { period?: FinancePeriod; referenceDate?: string }): BalanceSummary {
    const periodTxs = this.listTransactions({
      period: params?.period ?? 'THIS_MONTH',
      referenceDate: params?.referenceDate,
    }).filter((tx) => tx.status === 'PAID');

    const incomeCents = sumCents(
      periodTxs.filter((t) => t.type === 'INCOME').map((t) => t.amountCents),
    );
    const expenseCents = sumCents(
      periodTxs.filter((t) => t.type === 'EXPENSE').map((t) => t.amountCents),
    );

    return { incomeCents, expenseCents, balanceCents: incomeCents - expenseCents };
  }

  getHideBalance(): boolean {
    const row = this.db
      .select()
      .from(schema.financePreferences)
      .where(eq(schema.financePreferences.id, DEFAULT_PREF_ID))
      .get();
    return row?.hideBalance ?? false;
  }

  toggleHideBalance(): boolean {
    const existing = this.db
      .select()
      .from(schema.financePreferences)
      .where(eq(schema.financePreferences.id, DEFAULT_PREF_ID))
      .get();

    const nextValue = !(existing?.hideBalance ?? false);
    if (!existing) {
      this.db
        .insert(schema.financePreferences)
        .values({ id: DEFAULT_PREF_ID, hideBalance: nextValue })
        .run();
    } else {
      this.db
        .update(schema.financePreferences)
        .set({ hideBalance: nextValue })
        .where(eq(schema.financePreferences.id, DEFAULT_PREF_ID))
        .run();
    }
    return nextValue;
  }

  getDashboardView(filters?: TransactionFilters): FinancesDashboardView {
    const period = filters?.period ?? 'THIS_MONTH';
    const periodTxs = this.listTransactions({ period, referenceDate: filters?.referenceDate });
    const distinctDates = Array.from(new Set(periodTxs.map((t) => t.occurredAt))).sort((a, b) =>
      b.localeCompare(a),
    );
    const distinctCategories = Array.from(
      new Set(periodTxs.map((t) => t.category.toUpperCase())),
    ).sort();
    const allSavedCategories = this.db
      .select()
      .from(schema.transactions)
      .all()
      .map((t) => t.category.toUpperCase());
    const availableCategories = Array.from(
      new Set([...PRESET_TRANSACTION_CATEGORIES, ...allSavedCategories]),
    );

    return {
      period,
      dateFilter: filters?.date ?? '',
      categoryFilter: filters?.category ?? '',
      transactions: this.listTransactions({ ...filters, period }),
      distinctDates,
      distinctCategories,
      availableCategories,
      summary: this.getBalanceSummary({ period, referenceDate: filters?.referenceDate }),
      hideBalance: this.getHideBalance(),
    };
  }
}
