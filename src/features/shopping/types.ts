import { z } from 'zod';
import { assertPureDate } from '@/lib/dates';
import type * as schema from './schema';

export type ShoppingItemRecord = typeof schema.shoppingItems.$inferSelect;

export const shoppingItemStatusSchema = z.enum(['WISHLIST', 'IN_TRANSIT', 'DELIVERED']);
export type ShoppingItemStatus = z.infer<typeof shoppingItemStatusSchema>;

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
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'MÊS INICIAL INVÁLIDO (USE AAAA-MM)');

const optionalProductUrlSchema = z
  .string()
  .trim()
  .refine((val) => val.length === 0 || z.url().safeParse(val).success, 'URL DO PRODUTO INVÁLIDA')
  .nullable()
  .optional();

export const addWishlistItemSchema = z.object({
  name: z.string().trim().min(1, 'NOME OBRIGATÓRIO'),
  priceCents: z
    .number()
    .int('PREÇO DEVE SER INTEIRO EM CENTAVOS')
    .positive('PREÇO DEVE SER MAIOR QUE ZERO'),
  productUrl: optionalProductUrlSchema,
});

export const updateWishlistItemSchema = addWishlistItemSchema.partial();

export const updateInTransitItemSchema = addWishlistItemSchema
  .extend({
    storeApp: z.string().trim().min(1, 'APP DA COMPRA OBRIGATÓRIO'),
    estimatedDeliveryDate: pureDateSchema,
  })
  .partial();

export const purchasePaymentSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('CASH') }),
  z.object({
    mode: z.literal('INSTALLMENTS'),
    totalInstallments: z.number().int().min(1, 'MÍNIMO 1 PARCELA'),
    startMonth: competenceMonthSchema,
    creditCardId: z.string().nullable().optional(),
  }),
]);

export const markPurchasedBaseSchema = z.object({
  storeApp: z.string().trim().min(1, 'APP DA COMPRA OBRIGATÓRIO'),
  estimatedDeliveryDate: pureDateSchema,
  purchasedAt: pureDateSchema.optional(),
  /** [SIM] = já lançado em Finanças; [NÃO] exige `payment`. */
  alreadyLoggedInFinances: z.boolean(),
  payment: purchasePaymentSchema.optional(),
});

export function validatePurchasePayment(
  val: { alreadyLoggedInFinances: boolean; payment?: unknown },
  ctx: z.RefinementCtx,
): void {
  if (!val.alreadyLoggedInFinances && !val.payment) {
    ctx.addIssue({
      code: 'custom',
      path: ['payment'],
      message: 'FORMA DE PAGAMENTO OBRIGATÓRIA',
    });
  }
}

export const markPurchasedSchema = markPurchasedBaseSchema.superRefine(validatePurchasePayment);

export const addPurchasedItemBaseSchema = addWishlistItemSchema.extend(markPurchasedBaseSchema.shape);

export const addPurchasedItemSchema = addPurchasedItemBaseSchema.superRefine(validatePurchasePayment);

export const markDeliveredSchema = z.object({
  deliveredAt: pureDateSchema.optional(),
});

export type AddWishlistItemInput = z.input<typeof addWishlistItemSchema>;
export type UpdateWishlistItemInput = z.input<typeof updateWishlistItemSchema>;
export type UpdateInTransitInput = z.input<typeof updateInTransitItemSchema>;
export type PurchasePayment = z.input<typeof purchasePaymentSchema>;
export type MarkPurchasedInput = z.input<typeof markPurchasedSchema>;
export type AddPurchasedItemInput = z.input<typeof addPurchasedItemSchema>;
export type MarkDeliveredInput = z.input<typeof markDeliveredSchema>;

export interface InTransitView extends ShoppingItemRecord {
  estimatedDeliveryWindowEnd: string;
  daysLeft: number;
  daysLeftToWindowEnd: number;
  isInDeliveryWindow: boolean;
  isOverdue: boolean;
  /** 0..1 do tempo decorrido entre compra e data estimada. */
  progress: number;
}
