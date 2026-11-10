'use server';

import { revalidatePath } from 'next/cache';
import { parseBRLToCents } from '@/lib/currency';
import {
  FinancesService,
  type CreateTransactionInput,
  type UpdateTransactionInput,
} from './service';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function createTransactionAction(raw: {
  type: 'INCOME' | 'EXPENSE';
  description: string;
  category: string;
  amountBRL: string;
  occurredAt: string;
}): Promise<ActionResult> {
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
    service.createTransaction(input);
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
  raw: {
    type: 'INCOME' | 'EXPENSE';
    description: string;
    category: string;
    amountBRL: string;
    occurredAt: string;
  },
): Promise<ActionResult> {
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
    service.updateTransaction(id, input);
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
  try {
    const service = new FinancesService();
    service.deleteTransaction(id);
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
  const service = new FinancesService();
  const hideBalance = service.toggleHideBalance();
  revalidatePath('/financas');
  revalidatePath('/');
  return { ok: true, hideBalance };
}
