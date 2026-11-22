import { z } from 'zod';
import {
  addPurchasedItemSchema as canonicalAddPurchasedItemSchema,
  addWishlistItemSchema as canonicalAddWishlistItemSchema,
  markDeliveredSchema as canonicalMarkDeliveredSchema,
  markPurchasedBaseSchema as canonicalMarkPurchasedBaseSchema,
  updateInTransitItemSchema as canonicalUpdateInTransitItemSchema,
  updateWishlistItemSchema as canonicalUpdateWishlistItemSchema,
  validatePurchasePayment,
} from '@/features/shopping/types';
import { toRecifeDateString } from '@/lib/dates';
import { defineAction, type ActionCatalogEntry, type ActionDefaultsContext } from './types';

function applyRecifeDateDefault(
  out: Record<string, unknown>,
  field: 'purchasedAt' | 'deliveredAt',
  ctx?: ActionDefaultsContext,
): void {
  const val = out[field];
  if (val === undefined || val === null || (typeof val === 'string' && !val.trim())) {
    out[field] = ctx?.currentDateRecife ?? toRecifeDateString();
  }
}

export function applyPurchaseDefaults(
  rawArgs: Record<string, unknown>,
  ctx?: ActionDefaultsContext,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...rawArgs };
  applyRecifeDateDefault(out, 'purchasedAt', ctx);
  if (out.productUrl === '') {
    out.productUrl = null;
  }
  return out;
}

export function applyMarkDeliveredDefaults(
  rawArgs: Record<string, unknown>,
  ctx?: ActionDefaultsContext,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...rawArgs };
  applyRecifeDateDefault(out, 'deliveredAt', ctx);
  return out;
}

export const addWishlistItemSchema = canonicalAddWishlistItemSchema;

export const updateWishlistItemSchema = z
  .object({
    id: z.string().min(1, 'ID OBRIGATÓRIO'),
  })
  .extend(canonicalUpdateWishlistItemSchema.shape);

export const deleteWishlistItemSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
});

export const addPurchasedItemSchema = canonicalAddPurchasedItemSchema;

export const updateInTransitItemSchema = z
  .object({
    id: z.string().min(1, 'ID OBRIGATÓRIO'),
  })
  .extend(canonicalUpdateInTransitItemSchema.shape);

export const markPurchasedSchema = z
  .object({
    id: z.string().min(1, 'ID OBRIGATÓRIO'),
  })
  .extend(canonicalMarkPurchasedBaseSchema.shape)
  .superRefine(validatePurchasePayment);

export const markDeliveredSchema = z
  .object({
    id: z.string().min(1, 'ID OBRIGATÓRIO'),
  })
  .extend(canonicalMarkDeliveredSchema.shape);

export const revertDeliveredSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
});

export const revertToWishlistSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
});

export const SHOPPING_CATALOG: Record<string, ActionCatalogEntry> = {
  addWishlistItem: defineAction({
    name: 'addWishlistItem',
    module: 'SHOPPING',
    displayName: 'ADICIONAR ITEM À WISHLIST',
    entityLabel: 'Item da Wishlist',
    operation: 'create',
    description: 'Adiciona um produto à lista de desejos (Quero Comprar).',
    isDestructive: false,
    schema: addWishlistItemSchema,
    fields: {
      name: { name: 'name', label: 'PRODUTO', description: 'Nome do produto desejado.', required: true },
      priceCents: { name: 'priceCents', label: 'PREÇO (CENTAVOS)', description: 'Preço estimado inteiro em centavos.', required: true },
      productUrl: { name: 'productUrl', label: 'LINK', description: 'URL opcional do produto.', required: false },
    },
  }),

  updateWishlistItem: defineAction({
    name: 'updateWishlistItem',
    module: 'SHOPPING',
    displayName: 'ATUALIZAR ITEM DA WISHLIST',
    entityLabel: 'Item da Wishlist',
    operation: 'update',
    description: 'Atualiza nome, preço ou link de um produto na lista de desejos.',
    isDestructive: false,
    schema: updateWishlistItemSchema,
    fields: {
      id: { name: 'id', label: 'ID', description: 'ID do Item da Wishlist.', required: true },
      name: { name: 'name', label: 'PRODUTO', description: 'Nome atualizado do produto.', required: false },
      priceCents: { name: 'priceCents', label: 'PREÇO (CENTAVOS)', description: 'Preço atualizado em centavos.', required: false },
      productUrl: { name: 'productUrl', label: 'LINK', description: 'URL atualizada.', required: false },
    },
  }),

  deleteWishlistItem: defineAction({
    name: 'deleteWishlistItem',
    module: 'SHOPPING',
    displayName: 'EXCLUIR ITEM DE COMPRAS',
    entityLabel: 'Item de Compras',
    operation: 'delete',
    description: 'Exclui um item de compras (Item da Wishlist, Entrega em Trânsito ou histórico entregue — exige confirmação explícita).',
    isDestructive: true,
    schema: deleteWishlistItemSchema,
    fields: {
      id: { name: 'id', label: 'ID', description: 'ID do item de compras a excluir.', required: true },
    },
  }),

  addPurchasedItem: defineAction({
    name: 'addPurchasedItem',
    module: 'SHOPPING',
    displayName: 'ADICIONAR ENTREGA EM TRÂNSITO',
    entityLabel: 'Entrega em Trânsito',
    operation: 'create',
    description:
      'Registra diretamente um produto já comprado em Entrega em Trânsito (Já Comprei / A Caminho), com loja, previsão de chegada e integração opcional com Finanças.',
    isDestructive: false,
    schema: addPurchasedItemSchema,
    inferableDefaults: {
      purchasedAt: (ctx) => ctx?.currentDateRecife ?? toRecifeDateString(),
    },
    applyDefaults: applyPurchaseDefaults,
    fields: {
      name: { name: 'name', label: 'PRODUTO', description: 'Nome do produto comprado.', required: true },
      priceCents: { name: 'priceCents', label: 'PREÇO (CENTAVOS)', description: 'Valor inteiro pago em centavos.', required: true },
      productUrl: { name: 'productUrl', label: 'LINK', description: 'URL opcional do produto.', required: false },
      storeApp: { name: 'storeApp', label: 'LOJA/APP', description: 'Loja ou app da compra (Mercado Livre, Shopee, Amazon, etc.).', required: true },
      estimatedDeliveryDate: { name: 'estimatedDeliveryDate', label: 'PREVISÃO DE ENTREGA', description: 'Data estimada inicial (AAAA-MM-DD).', required: true },
      purchasedAt: {
        name: 'purchasedAt',
        label: 'DATA DA COMPRA',
        description: 'Data da compra (AAAA-MM-DD).',
        required: false,
        inferableDefault: 'DATA DE HOJE EM RECIFE',
      },
      alreadyLoggedInFinances: {
        name: 'alreadyLoggedInFinances',
        label: 'JÁ LANÇADO EM FINANÇAS',
        description: 'true se já lançado manualmente em Finanças; false para lançar automaticamente.',
        required: true,
      },
      payment: {
        name: 'payment',
        label: 'FORMA DE PAGAMENTO',
        description: 'Obrigatório quando alreadyLoggedInFinances for false: CASH ou INSTALLMENTS (totalInstallments, startMonth, creditCardId).',
        required: false,
      },
    },
  }),

  updateInTransitItem: defineAction({
    name: 'updateInTransitItem',
    module: 'SHOPPING',
    displayName: 'ATUALIZAR ENTREGA EM TRÂNSITO',
    entityLabel: 'Entrega em Trânsito',
    operation: 'update',
    description: 'Edita nome, preço, link, loja/app ou previsão de chegada de uma Entrega em Trânsito.',
    isDestructive: false,
    schema: updateInTransitItemSchema,
    fields: {
      id: { name: 'id', label: 'ID', description: 'ID da Entrega em Trânsito.', required: true },
      name: { name: 'name', label: 'PRODUTO', description: 'Nome atualizado do produto.', required: false },
      priceCents: { name: 'priceCents', label: 'PREÇO (CENTAVOS)', description: 'Valor atualizado em centavos.', required: false },
      productUrl: { name: 'productUrl', label: 'LINK', description: 'URL atualizada.', required: false },
      storeApp: { name: 'storeApp', label: 'LOJA/APP', description: 'Loja ou app atualizado.', required: false },
      estimatedDeliveryDate: {
        name: 'estimatedDeliveryDate',
        label: 'PREVISÃO DE ENTREGA',
        description: 'Nova data estimada de entrega (AAAA-MM-DD).',
        required: false,
      },
    },
  }),

  markPurchased: defineAction({
    name: 'markPurchased',
    module: 'SHOPPING',
    displayName: 'REGISTRAR COMPRA (EM TRÂNSITO)',
    entityLabel: 'Entrega em Trânsito',
    operation: 'update',
    description: 'Move Item da Wishlist para Entrega em Trânsito com loja e previsão de chegada.',
    isDestructive: false,
    schema: markPurchasedSchema,
    inferableDefaults: {
      purchasedAt: (ctx) => ctx?.currentDateRecife ?? toRecifeDateString(),
    },
    applyDefaults: applyPurchaseDefaults,
    fields: {
      id: { name: 'id', label: 'ID', description: 'ID do Item da Wishlist.', required: true },
      storeApp: { name: 'storeApp', label: 'LOJA/APP', description: 'Loja ou app da compra (Mercado Livre, Shopee, etc.).', required: true },
      estimatedDeliveryDate: { name: 'estimatedDeliveryDate', label: 'PREVISÃO DE ENTREGA', description: 'Data estimada inicial (AAAA-MM-DD).', required: true },
      purchasedAt: {
        name: 'purchasedAt',
        label: 'DATA DA COMPRA',
        description: 'Data da compra (AAAA-MM-DD).',
        required: false,
        inferableDefault: 'DATA DE HOJE EM RECIFE',
      },
      alreadyLoggedInFinances: { name: 'alreadyLoggedInFinances', label: 'JÁ LANÇADO EM FINANÇAS', description: 'true se já lançado manualmente.', required: true },
      payment: { name: 'payment', label: 'PAGAMENTO', description: 'Modo CASH ou INSTALLMENTS.', required: false },
    },
  }),

  markDelivered: defineAction({
    name: 'markDelivered',
    module: 'SHOPPING',
    displayName: 'CONFIRMAR ENTREGA (CHEGOU!)',
    entityLabel: 'Entrega em Trânsito',
    operation: 'update',
    description: 'Registra a entrega de uma Entrega em Trânsito (Chegou!).',
    isDestructive: false,
    schema: markDeliveredSchema,
    inferableDefaults: {
      deliveredAt: (ctx) => ctx?.currentDateRecife ?? toRecifeDateString(),
    },
    applyDefaults: applyMarkDeliveredDefaults,
    fields: {
      id: { name: 'id', label: 'ID', description: 'ID da Entrega em Trânsito.', required: true },
      deliveredAt: {
        name: 'deliveredAt',
        label: 'DATA DA ENTREGA',
        description: 'Data de entrega (AAAA-MM-DD).',
        required: false,
        inferableDefault: 'DATA DE HOJE EM RECIFE',
      },
    },
  }),

  revertDelivered: defineAction({
    name: 'revertDelivered',
    module: 'SHOPPING',
    displayName: 'REVERTER ENTREGA',
    entityLabel: 'Entrega em Trânsito',
    operation: 'update',
    description: 'Reverte uma compra entregue de volta para Entrega em Trânsito.',
    isDestructive: false,
    schema: revertDeliveredSchema,
    fields: {
      id: { name: 'id', label: 'ID', description: 'ID do item entregue.', required: true },
    },
  }),

  revertToWishlist: defineAction({
    name: 'revertToWishlist',
    module: 'SHOPPING',
    displayName: 'REVERTER PARA WISHLIST',
    entityLabel: 'Item da Wishlist',
    operation: 'update',
    description: 'Reverte uma compra de volta para a Wishlist.',
    isDestructive: false,
    schema: revertToWishlistSchema,
    fields: {
      id: { name: 'id', label: 'ID', description: 'ID do item de compras.', required: true },
    },
  }),
};
