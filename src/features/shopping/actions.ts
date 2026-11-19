'use server';

import { revalidatePath } from 'next/cache';
import { requireSessionAuth } from '@/lib/session-auth';
import {
  ShoppingService,
  type AddPurchasedItemInput,
  type AddWishlistItemInput,
  type MarkPurchasedInput,
  type UpdateInTransitInput,
} from './service';

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

function run<T>(fn: (service: ShoppingService) => T, fallback: string): ActionResult<T> {
  try {
    const data = fn(new ShoppingService());
    revalidatePath('/compras');
    revalidatePath('/financas');
    revalidatePath('/calendario');
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : fallback };
  }
}

export async function addWishlistItemAction(input: AddWishlistItemInput) {
  await requireSessionAuth();
  return run((s) => s.addWishlistItem(input), 'ERRO AO ADICIONAR ITEM');
}

export async function updateWishlistItemAction(id: string, input: AddWishlistItemInput) {
  await requireSessionAuth();
  return run((s) => s.updateWishlistItem(id, input), 'ERRO AO EDITAR ITEM');
}

export async function updateInTransitItemAction(id: string, input: UpdateInTransitInput) {
  await requireSessionAuth();
  return run((s) => s.updateInTransitItem(id, input), 'ERRO AO EDITAR COMPRA');
}

export async function addPurchasedItemAction(input: AddPurchasedItemInput) {
  await requireSessionAuth();
  return run((s) => s.addPurchasedItem(input), 'ERRO AO ADICIONAR COMPRA');
}

export async function markPurchasedAction(id: string, input: MarkPurchasedInput) {
  await requireSessionAuth();
  return run((s) => s.markPurchased(id, input), 'ERRO AO REGISTRAR COMPRA');
}

export async function markDeliveredAction(id: string) {
  await requireSessionAuth();
  return run((s) => s.markDelivered(id), 'ERRO AO MARCAR COMO ENTREGUE');
}

export async function revertDeliveredAction(id: string) {
  await requireSessionAuth();
  return run((s) => s.revertDelivered(id), 'ERRO AO REVERTER ENTREGA');
}

export async function revertToWishlistAction(id: string) {
  await requireSessionAuth();
  return run((s) => s.revertToWishlist(id), 'ERRO AO VOLTAR PARA WISHLIST');
}

export async function deleteItemAction(id: string) {
  await requireSessionAuth();
  return run((s) => s.deleteItem(id), 'ERRO AO EXCLUIR ITEM');
}
