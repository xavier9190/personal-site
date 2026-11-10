import { z } from 'zod';
import { assertPureDate } from '@/lib/dates';
import type { Cents } from '@/lib/currency';
import type * as schema from './schema';

export type FinancePeriod = 'THIS_MONTH' | 'LAST_MONTH' | 'NEXT_MONTH' | 'ALL';
export type TransactionRecord = typeof schema.transactions.$inferSelect;
export type PayableBillRecord = typeof schema.payableBills.$inferSelect;
export type CreditCardRecord = typeof schema.creditCards.$inferSelect;
export type InstallmentPlanRecord = typeof schema.installmentPlans.$inferSelect;

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

const pureDateSchema = z.string().refine((val) => {
  try {
    assertPureDate(val);
    return true;
  } catch {
    return false;
  }
}, 'DATA INVÁLIDA (USE AAAA-MM-DD)');

const competenceMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'MÊS DE COMPETÊNCIA INVÁLIDO (USE AAAA-MM)');

export const createTransactionSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']),
  description: z.string().trim().min(1, 'DESCRIÇÃO OBRIGATÓRIA'),
  category: z.string().trim().min(1, 'CATEGORIA OBRIGATÓRIA'),
  amountCents: z.number().int().positive('VALOR DEVE SER MAIOR QUE ZERO'),
  occurredAt: pureDateSchema,
  status: z.enum(['PAID', 'PENDING']).default('PAID'),
});

export const updateTransactionSchema = createTransactionSchema.partial();

export const createPayableBillSchema = z.object({
  title: z.string().trim().min(1, 'TÍTULO OBRIGATÓRIO'),
  billType: z.enum([
    'FIXED_RECURRING',
    'CREDIT_CARD_BILL',
    'DEBT_TO_PERSON',
    'SINGLE_BILL',
  ]),
  amountCents: z.number().int().positive('VALOR DEVE SER MAIOR QUE ZERO'),
  category: z.string().trim().min(1, 'CATEGORIA OBRIGATÓRIA'),
  dueDate: pureDateSchema,
  competenceMonth: competenceMonthSchema.optional(),
  creditCardId: z.string().nullable().optional(),
});

export const updatePayableBillSchema = createPayableBillSchema.partial();

export const createCreditCardSchema = z.object({
  name: z.string().trim().min(1, 'NOME DO CARTÃO OBRIGATÓRIO'),
  closingDay: z.number().int().min(1).max(31),
  dueDay: z.number().int().min(1).max(31),
  limitCents: z.number().int().positive().nullable().optional(),
});

export const createInstallmentPlanSchema = z.object({
  description: z.string().trim().min(1, 'DESCRIÇÃO OBRIGATÓRIA'),
  category: z.string().trim().min(1, 'CATEGORIA OBRIGATÓRIA'),
  totalInstallments: z.number().int().min(1, 'MÍNIMO 1 PARCELA'),
  paidInstallments: z.number().int().min(0).default(0),
  installmentAmountCents: z.number().int().positive('VALOR DA PARCELA INVÁLIDO'),
  creditCardId: z.string().nullable().optional(),
  startMonth: competenceMonthSchema,
  shoppingItemId: z.string().nullable().optional(),
});

export type CreateTransactionInput = z.input<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.input<typeof updateTransactionSchema>;
export type CreatePayableBillInput = z.input<typeof createPayableBillSchema>;
export type UpdatePayableBillInput = z.input<typeof updatePayableBillSchema>;
export type CreateCreditCardInput = z.input<typeof createCreditCardSchema>;
export type CreateInstallmentPlanInput = z.input<typeof createInstallmentPlanSchema>;

export interface InstallmentPlanView extends InstallmentPlanRecord {
  remainingInstallments: number;
  headerText: string;
  subtitleText: string;
  creditCardName: string | null;
}

export interface BalanceSummary {
  incomeCents: Cents;
  expenseCents: Cents;
  balanceCents: Cents;
  toPayCents: Cents;
  pendingBillsCount: number;
  forecastCents: Cents;
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
  payableBills: PayableBillRecord[];
  creditCards: CreditCardRecord[];
  installmentPlans: InstallmentPlanView[];
  distinctDates: string[];
  distinctCategories: string[];
  availableCategories: string[];
  summary: BalanceSummary;
  hideBalance: boolean;
}
