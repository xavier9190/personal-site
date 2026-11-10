import { z } from 'zod';
import { assertPureDate } from '@/lib/dates';
import type { Cents } from '@/lib/currency';
import type * as schema from './schema';

export type FinancePeriod = 'THIS_MONTH' | 'LAST_MONTH' | 'NEXT_MONTH' | 'ALL';
export type TransactionRecord = typeof schema.transactions.$inferSelect;

export const PRESET_TRANSACTION_CATEGORIES: readonly string[] = [
  'ALIMENTAÇÃO',
  'TRANSPORTE',
  'MORADIA',
  'ASSINATURAS',
  'LAZER',
  'SAÚDE',
  'EDUCAÇÃO',
  'COMPRAS',
  'TRABALHO',
  'OUTROS',
] as const;

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

export interface FinancesDashboardView {
  period: FinancePeriod;
  dateFilter: string;
  categoryFilter: string;
  transactions: TransactionRecord[];
  distinctDates: string[];
  distinctCategories: string[];
  availableCategories: string[];
  summary: BalanceSummary;
  hideBalance: boolean;
}
