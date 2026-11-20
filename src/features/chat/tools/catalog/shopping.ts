import { z } from 'zod';
import { defineAction, type ActionCatalogEntry } from './types';

export const addWishlistItemSchema = z.object({
  name: z.string().trim().min(1, 'NOME DO PRODUTO OBRIGATÓRIO'),
  priceCents: z.number().int().positive('PREÇO DEVE SER POSITIVO'),
  productUrl: z.string().url().nullable().optional(),
});

export const updateWishlistItemSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
  name: z.string().trim().min(1, 'NOME DO PRODUTO OBRIGATÓRIO'),
  priceCents: z.number().int().positive('PREÇO DEVE SER POSITIVO'),
  productUrl: z.string().url().nullable().optional(),
});

export const deleteWishlistItemSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
});

export const markPurchasedSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
  storeApp: z.string().trim().min(1, 'LOJA/APP OBRIGATÓRIO'),
  estimatedDeliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'DATA ESTIMADA INVÁLIDA'),
  purchasedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  alreadyLoggedInFinances: z.boolean(),
  payment: z
    .discriminatedUnion('mode', [
      z.object({ mode: z.literal('CASH') }),
      z.object({
        mode: z.literal('INSTALLMENTS'),
        totalInstallments: z.number().int().min(2),
        startMonth: z.string().regex(/^\d{4}-\d{2}$/),
        creditCardId: z.string().nullable().optional(),
      }),
    ])
    .optional(),
});

export const markDeliveredSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
  deliveredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

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
    description: 'Atualiza um produto na lista de desejos.',
    isDestructive: false,
    schema: updateWishlistItemSchema,
    fields: {
      id: { name: 'id', label: 'ID', description: 'ID do Item da Wishlist.', required: true },
      name: { name: 'name', label: 'PRODUTO', description: 'Nome atualizado do produto.', required: true },
      priceCents: { name: 'priceCents', label: 'PREÇO (CENTAVOS)', description: 'Preço atualizado em centavos.', required: true },
      productUrl: { name: 'productUrl', label: 'LINK', description: 'URL atualizada.', required: false },
    },
  }),

  deleteWishlistItem: defineAction({
    name: 'deleteWishlistItem',
    module: 'SHOPPING',
    displayName: 'EXCLUIR ITEM DE COMPRAS',
    entityLabel: 'Item da Wishlist',
    operation: 'delete',
    description: 'Exclui um item da lista de compras (exige confirmação explícita).',
    isDestructive: true,
    schema: deleteWishlistItemSchema,
    fields: {
      id: { name: 'id', label: 'ID', description: 'ID do item de compras a excluir.', required: true },
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
    fields: {
      id: { name: 'id', label: 'ID', description: 'ID do Item da Wishlist.', required: true },
      storeApp: { name: 'storeApp', label: 'LOJA/APP', description: 'Loja ou app da compra (Mercado Livre, Shopee, etc.).', required: true },
      estimatedDeliveryDate: { name: 'estimatedDeliveryDate', label: 'PREVISÃO DE ENTREGA', description: 'Data estimada inicial (AAAA-MM-DD).', required: true },
      purchasedAt: { name: 'purchasedAt', label: 'DATA DA COMPRA', description: 'Data da compra (AAAA-MM-DD).', required: false },
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
    fields: {
      id: { name: 'id', label: 'ID', description: 'ID da Entrega em Trânsito.', required: true },
      deliveredAt: { name: 'deliveredAt', label: 'DATA DA ENTREGA', description: 'Data de entrega (AAAA-MM-DD).', required: false },
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
