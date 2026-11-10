'use server';

import { revalidatePath } from 'next/cache';
import { parseBRLToCents } from '@/lib/currency';
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

async function run(fn: (service: FinancesService) => void, fallback: string): Promise<BillActionResult> {
  try {
    fn(new FinancesService());
    revalidatePath('/financas');
    revalidatePath('/');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : fallback };
  }
}

export async function createPayableBillAction(raw: BillFormPayload) {
  return run(
    (s) =>
      void s.createPayableBill({
        title: raw.title,
        billType: raw.billType,
        category: raw.category,
        amountCents: parseBRLToCents(raw.amountBRL),
        dueDate: raw.dueDate,
      }),
    'ERRO AO SALVAR CONTA',
  );
}

export async function togglePayableBillStatusAction(id: string, paid: boolean) {
  return run(
    (s) => void (paid ? s.markBillPaid(id) : s.markBillPending(id)),
    'ERRO AO ATUALIZAR CONTA',
  );
}

export async function deletePayableBillAction(id: string) {
  return run((s) => s.deletePayableBill(id), 'ERRO AO EXCLUIR CONTA');
}

export async function createCreditCardAction(raw: CardFormPayload) {
  return run((s) => void s.createCreditCard(raw), 'ERRO AO SALVAR CARTÃO');
}

export async function deleteCreditCardAction(id: string) {
  return run((s) => s.deleteCreditCard(id), 'ERRO AO EXCLUIR CARTÃO');
}

export async function createInstallmentPlanAction(raw: InstallmentFormPayload) {
  return run(
    (s) =>
      void s.createInstallmentPlan({
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

export async function advanceInstallmentAction(id: string) {
  return run((s) => void s.advanceInstallment(id), 'ERRO AO AVANÇAR PARCELA');
}

export async function deleteInstallmentPlanAction(id: string) {
  return run((s) => s.deleteInstallmentPlan(id), 'ERRO AO EXCLUIR PARCELAMENTO');
}
