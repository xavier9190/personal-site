import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { AppDatabase } from '@/db';
import { getDb } from '@/db';
import { assertPureDate, toRecifeDateString } from '@/lib/dates';
import { sumCents, type Cents } from '@/lib/currency';
import * as schema from './schema';

export type FinancePeriod = 'THIS_MONTH' | 'LAST_MONTH' | 'NEXT_MONTH' | 'ALL';

export const createTransactionSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']),
  description: z.string().trim().min(1, 'DESCRIÇÃO OBRIGATÓRIA'),
  category: z.string().trim().min(1, 'CATEGORIA OBRIGATÓRIA'),
  amountCents: z.number().int().positive('VALOR DEVE SER MAIOR QUE ZERO'),
  occurredAt: z.string().refine((val) => {
    try {
      assertPureDate(val);
      return true;
    } catch {
      return false;
    }
  }, 'DATA INVÁLIDA (USE AAAA-MM-DD)'),
  status: z.enum(['PAID', 'PENDING']).default('PAID'),
});

export const updateTransactionSchema = createTransactionSchema.partial();

export type CreateTransactionInput = z.input<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.input<typeof updateTransactionSchema>;

export interface BalanceSummary {
  incomeCents: Cents;
  expenseCents: Cents;
  balanceCents: Cents;
}

export interface TransactionFilters {
  period?: FinancePeriod;
  referenceDate?: string;
  date?: string;
  category?: string;
}

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

  createTransaction(input: CreateTransactionInput) {
    const parsed = createTransactionSchema.parse(input);
    const record = {
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

  updateTransaction(id: string, input: UpdateTransactionInput) {
    const existing = this.db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, id))
      .get();

    if (!existing) {
      throw new Error(`TRANSAÇÃO NÃO ENCONTRADA: ${id}`);
    }

    const parsed = updateTransactionSchema.parse(input);
    const updated = {
      ...existing,
      type: parsed.type ?? existing.type,
      description: parsed.description
        ? parsed.description.toUpperCase()
        : existing.description,
      category: parsed.category ? parsed.category.toUpperCase() : existing.category,
      amountCents: parsed.amountCents ?? existing.amountCents,
      occurredAt: parsed.occurredAt ?? existing.occurredAt,
      status: parsed.status ?? existing.status,
    };

    this.db
      .update(schema.transactions)
      .set(updated)
      .where(eq(schema.transactions.id, id))
      .run();

    return updated;
  }

  deleteTransaction(id: string) {
    this.db.delete(schema.transactions).where(eq(schema.transactions.id, id)).run();
  }

  listTransactions(filters?: TransactionFilters) {
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

  listDistinctCategories(): string[] {
    const all = this.db.select().from(schema.transactions).all();
    return Array.from(new Set(all.map((t) => t.category.toUpperCase()))).sort();
  }

  listDistinctDates(period: FinancePeriod = 'ALL', referenceDate?: string): string[] {
    const txs = this.listTransactions({ period, referenceDate });
    return Array.from(new Set(txs.map((t) => t.occurredAt))).sort((a, b) =>
      b.localeCompare(a),
    );
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
    const current = this.getHideBalance();
    const nextValue = !current;
    const existing = this.db
      .select()
      .from(schema.financePreferences)
      .where(eq(schema.financePreferences.id, DEFAULT_PREF_ID))
      .get();

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

  listInstallmentPlans() {
    return this.db.select().from(schema.installmentPlans).all();
  }

  listPayableBills() {
    return this.db.select().from(schema.payableBills).all();
  }

  getBalanceSummary(params?: {
    period?: FinancePeriod;
    referenceDate?: string;
  }): BalanceSummary {
    const period = params?.period ?? 'THIS_MONTH';
    const prefix = getYearMonthPrefix(period, params?.referenceDate);
    const all = this.db.select().from(schema.transactions).all();

    const matching = all.filter((tx) => {
      if (tx.status !== 'PAID') return false;
      if (prefix && !tx.occurredAt.startsWith(prefix)) return false;
      return true;
    });

    const incomeCents = sumCents(
      matching.filter((t) => t.type === 'INCOME').map((t) => t.amountCents),
    );
    const expenseCents = sumCents(
      matching.filter((t) => t.type === 'EXPENSE').map((t) => t.amountCents),
    );

    return {
      incomeCents,
      expenseCents,
      balanceCents: incomeCents - expenseCents,
    };
  }
}
