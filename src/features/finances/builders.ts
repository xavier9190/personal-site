import crypto from 'node:crypto';
import {
  createCreditCardSchema,
  createInstallmentPlanSchema,
  createPayableBillSchema,
  createTransactionSchema,
  updatePayableBillSchema,
  updateTransactionSchema,
  type CreateCreditCardInput,
  type CreateInstallmentPlanInput,
  type CreatePayableBillInput,
  type CreateTransactionInput,
  type CreditCardRecord,
  type InstallmentPlanRecord,
  type PayableBillRecord,
  type TransactionRecord,
  type UpdatePayableBillInput,
  type UpdateTransactionInput,
} from './types';

export function buildNewTransaction(input: CreateTransactionInput): TransactionRecord {
  const parsed = createTransactionSchema.parse(input);
  return {
    id: crypto.randomUUID(),
    type: parsed.type,
    description: parsed.description.toUpperCase(),
    category: parsed.category.toUpperCase(),
    amountCents: parsed.amountCents,
    occurredAt: parsed.occurredAt,
    status: parsed.status,
    payableBillId: null,
    shoppingItemId: parsed.shoppingItemId ?? null,
  };
}

export function buildUpdatedTransaction(
  existing: TransactionRecord,
  input: UpdateTransactionInput,
): TransactionRecord {
  const parsed = updateTransactionSchema.parse(input);
  return {
    ...existing,
    type: parsed.type ?? existing.type,
    description: parsed.description ? parsed.description.toUpperCase() : existing.description,
    category: parsed.category ? parsed.category.toUpperCase() : existing.category,
    amountCents: parsed.amountCents ?? existing.amountCents,
    occurredAt: parsed.occurredAt ?? existing.occurredAt,
    status: parsed.status ?? existing.status,
  };
}

export function buildNewPayableBill(input: CreatePayableBillInput): PayableBillRecord {
  const parsed = createPayableBillSchema.parse(input);
  return {
    id: crypto.randomUUID(),
    title: parsed.title.toUpperCase(),
    billType: parsed.billType,
    amountCents: parsed.amountCents,
    category: parsed.category.toUpperCase(),
    dueDate: parsed.dueDate,
    competenceMonth: parsed.competenceMonth ?? parsed.dueDate.slice(0, 7),
    status: 'PENDING',
    paidAt: null,
    creditCardId: parsed.creditCardId ?? null,
  };
}

export function buildUpdatedPayableBill(
  existing: PayableBillRecord,
  input: UpdatePayableBillInput,
): PayableBillRecord {
  const parsed = updatePayableBillSchema.parse(input);
  const dueDate = parsed.dueDate ?? existing.dueDate;
  return {
    ...existing,
    title: parsed.title ? parsed.title.toUpperCase() : existing.title,
    billType: parsed.billType ?? existing.billType,
    amountCents: parsed.amountCents ?? existing.amountCents,
    category: parsed.category ? parsed.category.toUpperCase() : existing.category,
    dueDate,
    competenceMonth: parsed.competenceMonth ?? dueDate.slice(0, 7),
    creditCardId: parsed.creditCardId !== undefined ? parsed.creditCardId : existing.creditCardId,
  };
}

export function buildNewCreditCard(input: CreateCreditCardInput): CreditCardRecord {
  const parsed = createCreditCardSchema.parse(input);
  return {
    id: crypto.randomUUID(),
    name: parsed.name.toUpperCase(),
    closingDay: parsed.closingDay,
    dueDay: parsed.dueDay,
    limitCents: parsed.limitCents ?? null,
  };
}

export function buildNewInstallmentPlan(input: CreateInstallmentPlanInput): InstallmentPlanRecord {
  const parsed = createInstallmentPlanSchema.parse(input);
  return {
    id: crypto.randomUUID(),
    description: parsed.description.toUpperCase(),
    category: parsed.category.toUpperCase(),
    totalInstallments: parsed.totalInstallments,
    paidInstallments: parsed.paidInstallments,
    installmentAmountCents: parsed.installmentAmountCents,
    creditCardId: parsed.creditCardId ?? null,
    startMonth: parsed.startMonth,
    shoppingItemId: parsed.shoppingItemId ?? null,
  };
}
