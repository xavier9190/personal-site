'use server';

import { revalidatePath } from 'next/cache';
import { parseBRLToCents } from '@/lib/currency';
import { requireSessionAuth } from '@/lib/session-auth';
import { FinancesService, type CreatePayableBillInput } from './service';

export interface BillActionResult {
  ok: boolean;
  error?: string;
}

export interface BillFormPayload {
  title: string;
  billType: CreatePayableBillInput['billType'];
  category: string;
  amountBRL: string;
  dueDate: string;
}

export interface CardFormPayload {
  name: string;
  closingDay: number;
  dueDay: number;
}

export interface InstallmentFormPayload {
  description: string;
  category: string;
  totalInstallments: number;
  paidInstallments: number;
  installmentAmountBRL: string;
  creditCardId: string | null;
  startMonth: string;
}

async function run(
  fn: (service: FinancesService) => Promise<unknown>,
  fallback: string,
): Promise<BillActionResult> {
  try {
    await fn(new FinancesService());
    revalidatePath('/financas');
    revalidatePath('/');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : fallback };
  }
}

export async function createPayableBillAction(raw: BillFormPayload) {
  await requireSessionAuth();
  return run(
    (s) =>
      s.createPayableBill({
        title: raw.title,
        billType: raw.billType,
        category: raw.category,
        amountCents: parseBRLToCents(raw.amountBRL),
        dueDate: raw.dueDate,
      }),
    'ERRO AO SALVAR CONTA',
  );
}

export async function updatePayableBillAction(id: string, raw: BillFormPayload) {
  await requireSessionAuth();
  return run(
    (s) =>
      s.updatePayableBill(id, {
        title: raw.title,
        billType: raw.billType,
        category: raw.category,
        amountCents: parseBRLToCents(raw.amountBRL),
        dueDate: raw.dueDate,
      }),
    'ERRO AO ATUALIZAR CONTA',
  );
}

export async function togglePayableBillStatusAction(id: string, paid: boolean) {
  await requireSessionAuth();
  return run(
    (s) => (paid ? s.markBillPaid(id) : s.markBillPending(id)),
    'ERRO AO ATUALIZAR CONTA',
  );
}

export async function deletePayableBillAction(id: string) {
  await requireSessionAuth();
  return run((s) => s.deletePayableBill(id), 'ERRO AO EXCLUIR CONTA');
}

export async function createCreditCardAction(raw: CardFormPayload) {
  await requireSessionAuth();
  return run((s) => s.createCreditCard(raw), 'ERRO AO SALVAR CARTÃO');
}

export async function deleteCreditCardAction(id: string) {
  await requireSessionAuth();
  return run((s) => s.deleteCreditCard(id), 'ERRO AO EXCLUIR CARTÃO');
}

export async function createInstallmentPlanAction(raw: InstallmentFormPayload) {
  await requireSessionAuth();
  return run(
    (s) =>
      s.createInstallmentPlan({
        description: raw.description,
        category: raw.category,
        totalInstallments: raw.totalInstallments,
        paidInstallments: raw.paidInstallments,
        installmentAmountCents: parseBRLToCents(raw.installmentAmountBRL),
        creditCardId: raw.creditCardId,
        startMonth: raw.startMonth,
      }),
    'ERRO AO SALVAR PARCELAMENTO',
  );
}

export async function updateInstallmentPlanAction(id: string, raw: InstallmentFormPayload) {
  await requireSessionAuth();
  return run(
    (s) =>
      s.updateInstallmentPlan(id, {
        description: raw.description,
        category: raw.category,
        totalInstallments: raw.totalInstallments,
        paidInstallments: raw.paidInstallments,
        installmentAmountCents: parseBRLToCents(raw.installmentAmountBRL),
        creditCardId: raw.creditCardId,
        startMonth: raw.startMonth,
      }),
    'ERRO AO ATUALIZAR PARCELAMENTO',
  );
}

export async function advanceInstallmentAction(id: string) {
  await requireSessionAuth();
  return run((s) => s.advanceInstallment(id), 'ERRO AO AVANÇAR PARCELA');
}

export async function deleteInstallmentPlanAction(id: string) {
  await requireSessionAuth();
  return run((s) => s.deleteInstallmentPlan(id), 'ERRO AO EXCLUIR PARCELAMENTO');
}
