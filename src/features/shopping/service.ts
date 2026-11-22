import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { AppDatabase } from '@/db';
import { getDb } from '@/db';
import { FinancesService } from '@/features/finances/service';
import { addDaysToPureDate, daysBetweenPureDates, toRecifeDateString } from '@/lib/dates';
import * as schema from './schema';
import {
  addPurchasedItemSchema,
  addWishlistItemSchema,
  markDeliveredSchema,
  markPurchasedSchema,
  updateInTransitItemSchema,
  updateWishlistItemSchema,
  type AddPurchasedItemInput,
  type AddWishlistItemInput,
  type InTransitView,
  type MarkPurchasedInput,
  type PurchasePayment,
  type ShoppingItemRecord,
  type UpdateInTransitInput,
  type UpdateWishlistItemInput,
} from './types';

export * from './types';

export const DELIVERY_WINDOW_DAYS = 5;

export class ShoppingService {
  private readonly finances: FinancesService;

  constructor(private readonly db: AppDatabase = getDb()) {
    this.finances = new FinancesService(db);
  }

  private async getItem(id: string): Promise<ShoppingItemRecord> {
    const [item] = await this.db
      .select()
      .from(schema.shoppingItems)
      .where(eq(schema.shoppingItems.id, id));
    if (!item) throw new Error(`ITEM NÃO ENCONTRADO: ${id}`);
    return item;
  }

  private async patch(
    id: string,
    values: Partial<ShoppingItemRecord>,
  ): Promise<ShoppingItemRecord> {
    await this.db.update(schema.shoppingItems).set(values).where(eq(schema.shoppingItems.id, id));
    return this.getItem(id);
  }

  async listItemsBySection(): Promise<{
    wishlist: ShoppingItemRecord[];
    inTransit: ShoppingItemRecord[];
    delivered: ShoppingItemRecord[];
  }> {
    const all = await this.db.select().from(schema.shoppingItems);
    return {
      wishlist: all.filter((item) => item.status === 'WISHLIST'),
      inTransit: all.filter((item) => item.status === 'IN_TRANSIT'),
      delivered: all.filter((item) => item.status === 'DELIVERED'),
    };
  }

  async addWishlistItem(input: AddWishlistItemInput): Promise<ShoppingItemRecord> {
    const parsed = addWishlistItemSchema.parse(input);
    const record: ShoppingItemRecord = {
      id: crypto.randomUUID(),
      name: parsed.name.toUpperCase(),
      priceCents: parsed.priceCents,
      productUrl: parsed.productUrl?.trim() || null,
      status: 'WISHLIST',
      storeApp: null,
      trackingUrl: null,
      purchasedAt: null,
      estimatedDeliveryDate: null,
      deliveredAt: null,
    };
    await this.db.insert(schema.shoppingItems).values(record);
    return record;
  }

  async updateWishlistItem(id: string, input: UpdateWishlistItemInput): Promise<ShoppingItemRecord> {
    const parsed = updateWishlistItemSchema.parse(input);
    const item = await this.getItem(id);
    if (item.status !== 'WISHLIST') throw new Error('ITEM NÃO ESTÁ NA WISHLIST');
    return this.patch(id, {
      name: parsed.name !== undefined ? parsed.name.toUpperCase() : item.name,
      priceCents: parsed.priceCents !== undefined ? parsed.priceCents : item.priceCents,
      productUrl:
        parsed.productUrl !== undefined ? parsed.productUrl?.trim() || null : item.productUrl,
    });
  }

  async updateInTransitItem(id: string, input: UpdateInTransitInput): Promise<ShoppingItemRecord> {
    const parsed = updateInTransitItemSchema.parse(input);
    const item = await this.getItem(id);
    if (item.status !== 'IN_TRANSIT') throw new Error('ITEM NÃO ESTÁ A CAMINHO');
    const nextEstimatedDeliveryDate = parsed.estimatedDeliveryDate ?? item.estimatedDeliveryDate!;
    if (item.purchasedAt && nextEstimatedDeliveryDate) {
      daysBetweenPureDates(item.purchasedAt, nextEstimatedDeliveryDate);
    }
    return this.patch(id, {
      name: parsed.name !== undefined ? parsed.name.toUpperCase() : item.name,
      priceCents: parsed.priceCents !== undefined ? parsed.priceCents : item.priceCents,
      productUrl:
        parsed.productUrl !== undefined ? parsed.productUrl?.trim() || null : item.productUrl,
      storeApp: parsed.storeApp !== undefined ? parsed.storeApp.toUpperCase() : item.storeApp,
      estimatedDeliveryDate: nextEstimatedDeliveryDate,
    });
  }

  async deleteItem(id: string): Promise<void> {
    await this.db.delete(schema.shoppingItems).where(eq(schema.shoppingItems.id, id));
  }

  async addPurchasedItem(input: AddPurchasedItemInput): Promise<ShoppingItemRecord> {
    const parsed = addPurchasedItemSchema.parse(input);
    const purchasedAt = parsed.purchasedAt ?? toRecifeDateString();
    daysBetweenPureDates(purchasedAt, parsed.estimatedDeliveryDate);

    const record: ShoppingItemRecord = {
      id: crypto.randomUUID(),
      name: parsed.name.toUpperCase(),
      priceCents: parsed.priceCents,
      productUrl: parsed.productUrl?.trim() || null,
      status: 'IN_TRANSIT',
      storeApp: parsed.storeApp.toUpperCase(),
      trackingUrl: null,
      purchasedAt,
      estimatedDeliveryDate: parsed.estimatedDeliveryDate,
      deliveredAt: null,
    };

    await this.db.transaction(async (tx) => {
      await tx.insert(schema.shoppingItems).values(record);

      if (!parsed.alreadyLoggedInFinances && parsed.payment) {
        await this.logInFinances(
          record,
          purchasedAt,
          parsed.payment,
          new FinancesService(tx as unknown as AppDatabase),
        );
      }
    });

    return record;
  }

  async markPurchased(id: string, input: MarkPurchasedInput): Promise<ShoppingItemRecord> {
    const parsed = markPurchasedSchema.parse(input);
    const item = await this.getItem(id);
    if (item.status !== 'WISHLIST') throw new Error('ITEM JÁ FOI COMPRADO');
    const purchasedAt = parsed.purchasedAt ?? toRecifeDateString();
    daysBetweenPureDates(purchasedAt, parsed.estimatedDeliveryDate);

    const patchValues = {
      status: 'IN_TRANSIT' as const,
      storeApp: parsed.storeApp.toUpperCase(),
      purchasedAt,
      estimatedDeliveryDate: parsed.estimatedDeliveryDate,
    };

    await this.db.transaction(async (tx) => {
      if (!parsed.alreadyLoggedInFinances && parsed.payment) {
        await this.logInFinances(
          item,
          purchasedAt,
          parsed.payment,
          new FinancesService(tx as unknown as AppDatabase),
        );
      }
      await tx.update(schema.shoppingItems).set(patchValues).where(eq(schema.shoppingItems.id, id));
    });

    return this.getItem(id);
  }

  private async logInFinances(
    item: ShoppingItemRecord,
    purchasedAt: string,
    payment: PurchasePayment,
    finances: FinancesService,
  ): Promise<void> {
    if (payment.mode === 'CASH') {
      await finances.createTransaction({
        type: 'EXPENSE',
        description: item.name,
        category: 'COMPRAS',
        amountCents: item.priceCents,
        occurredAt: purchasedAt,
        shoppingItemId: item.id,
      });
      return;
    }
    await finances.createInstallmentPlan({
      description: item.name,
      category: 'COMPRAS',
      totalInstallments: payment.totalInstallments,
      installmentAmountCents: Math.ceil(item.priceCents / payment.totalInstallments),
      startMonth: payment.startMonth,
      creditCardId: payment.creditCardId ?? null,
      shoppingItemId: item.id,
    });
  }

  private toInTransitViews(
    inTransit: ShoppingItemRecord[],
    today: string,
  ): InTransitView[] {
    return inTransit.map((item) => {
      const estimated = item.estimatedDeliveryDate!;
      const estimatedDeliveryWindowEnd = addDaysToPureDate(estimated, DELIVERY_WINDOW_DAYS);
      const total = daysBetweenPureDates(item.purchasedAt!, estimated);
      const elapsed = daysBetweenPureDates(item.purchasedAt!, today);
      const daysLeft = daysBetweenPureDates(today, estimated);
      const daysLeftToWindowEnd = daysBetweenPureDates(today, estimatedDeliveryWindowEnd);
      const isInDeliveryWindow = daysLeft <= 0 && daysLeftToWindowEnd >= 0;
      const isOverdue = daysLeftToWindowEnd < 0;
      const progress = total <= 0 ? 1 : Math.min(1, Math.max(0, elapsed / total));
      return {
        ...item,
        estimatedDeliveryWindowEnd,
        daysLeft,
        daysLeftToWindowEnd,
        isInDeliveryWindow,
        isOverdue,
        progress,
      };
    });
  }

  async listInTransitView(today: string = toRecifeDateString()): Promise<InTransitView[]> {
    const { inTransit } = await this.listItemsBySection();
    return this.toInTransitViews(inTransit, today);
  }

  async getDashboardView(today: string = toRecifeDateString()): Promise<{
    wishlist: ShoppingItemRecord[];
    inTransit: InTransitView[];
    delivered: ShoppingItemRecord[];
  }> {
    const { wishlist, inTransit, delivered } = await this.listItemsBySection();
    return {
      wishlist,
      inTransit: this.toInTransitViews(inTransit, today),
      delivered,
    };
  }

  async markDelivered(
    id: string,
    deliveredAt: string = toRecifeDateString(),
  ): Promise<ShoppingItemRecord> {
    const parsed = markDeliveredSchema.parse({ deliveredAt });
    const finalDeliveredAt = parsed.deliveredAt ?? toRecifeDateString();
    if ((await this.getItem(id)).status !== 'IN_TRANSIT') throw new Error('ITEM NÃO ESTÁ A CAMINHO');
    return this.patch(id, { status: 'DELIVERED', deliveredAt: finalDeliveredAt });
  }

  async revertDelivered(id: string): Promise<ShoppingItemRecord> {
    if ((await this.getItem(id)).status !== 'DELIVERED') throw new Error('ITEM NÃO FOI ENTREGUE');
    return this.patch(id, { status: 'IN_TRANSIT', deliveredAt: null });
  }

  async revertToWishlist(id: string): Promise<ShoppingItemRecord> {
    const item = await this.getItem(id);
    if (item.status === 'WISHLIST') throw new Error('ITEM JÁ ESTÁ NA WISHLIST');
    return this.patch(id, {
      status: 'WISHLIST',
      storeApp: null,
      purchasedAt: null,
      estimatedDeliveryDate: null,
      deliveredAt: null,
    });
  }
}
