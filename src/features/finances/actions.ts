'use server';

import { revalidatePath } from 'next/cache';
import { parseBRLToCents } from '@/lib/currency';
import { requireSessionAuth } from '@/lib/session-auth';
import {
  FinancesService,
  type CreateTransactionInput,
  type UpdateTransactionInput,
} from './service';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface TransactionFormPayload {
  type: 'INCOME' | 'EXPENSE';
  description: string;
  category: string;
  amountBRL: string;
  occurredAt: string;
}

export async function createTransactionAction(
  raw: TransactionFormPayload,
): Promise<ActionResult> {
  await requireSessionAuth();
  try {
    const amountCents = parseBRLToCents(raw.amountBRL);
    const service = new FinancesService();
    const input: CreateTransactionInput = {
      type: raw.type,
      description: raw.description,
      category: raw.category,
      amountCents,
      occurredAt: raw.occurredAt,
      status: 'PAID',
    };
    await service.createTransaction(input);
    revalidatePath('/financas');
    revalidatePath('/');
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'ERRO AO SALVAR TRANSAÇÃO',
    };
  }
}

export async function updateTransactionAction(
  id: string,
  raw: TransactionFormPayload,
): Promise<ActionResult> {
  await requireSessionAuth();
  try {
    const amountCents = parseBRLToCents(raw.amountBRL);
    const service = new FinancesService();
    const input: UpdateTransactionInput = {
      type: raw.type,
      description: raw.description,
      category: raw.category,
      amountCents,
      occurredAt: raw.occurredAt,
    };
    await service.updateTransaction(id, input);
    revalidatePath('/financas');
    revalidatePath('/');
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'ERRO AO ATUALIZAR TRANSAÇÃO',
    };
  }
}

export async function deleteTransactionAction(id: string): Promise<ActionResult> {
  await requireSessionAuth();
  try {
    const service = new FinancesService();
    await service.deleteTransaction(id);
    revalidatePath('/financas');
    revalidatePath('/');
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'ERRO AO EXCLUIR TRANSAÇÃO',
    };
  }
}

export async function toggleHideBalanceAction(): Promise<{
  ok: boolean;
  hideBalance: boolean;
}> {
  await requireSessionAuth();
  const service = new FinancesService();
  const hideBalance = await service.toggleHideBalance();
  revalidatePath('/financas');
  revalidatePath('/');
  return { ok: true, hideBalance };
}
