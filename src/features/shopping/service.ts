import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { AppDatabase } from '@/db';
import { getDb } from '@/db';
import { FinancesService } from '@/features/finances/service';
import { addDaysToPureDate, daysBetweenPureDates, toRecifeDateString } from '@/lib/dates';
import * as schema from './schema';

export const DELIVERY_WINDOW_DAYS = 5;

export type ShoppingItemRecord = typeof schema.shoppingItems.$inferSelect;

export interface AddWishlistItemInput {
  name: string;
  priceCents: number;
  productUrl?: string | null;
}

export interface UpdateInTransitInput extends AddWishlistItemInput {
  storeApp: string;
  estimatedDeliveryDate: string;
}

export type PurchasePayment =
  | { mode: 'CASH' }
  | { mode: 'INSTALLMENTS'; totalInstallments: number; startMonth: string; creditCardId?: string | null };

export interface MarkPurchasedInput {
  storeApp: string;
  estimatedDeliveryDate: string;
  purchasedAt?: string;
  /** [SIM] = já lançado em Finanças; [NÃO] exige `payment`. */
  alreadyLoggedInFinances: boolean;
  payment?: PurchasePayment;
}

export interface AddPurchasedItemInput extends AddWishlistItemInput, MarkPurchasedInput {}

export interface InTransitView extends ShoppingItemRecord {
  estimatedDeliveryWindowEnd: string;
  daysLeft: number;
  daysLeftToWindowEnd: number;
  isInDeliveryWindow: boolean;
  isOverdue: boolean;
  /** 0..1 do tempo decorrido entre compra e data estimada. */
  progress: number;
}

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
    const name = input.name.trim();
    if (!name) throw new Error('NOME OBRIGATÓRIO');
    if (!Number.isInteger(input.priceCents) || input.priceCents <= 0) {
      throw new Error('PREÇO DEVE SER MAIOR QUE ZERO');
    }
    const record: ShoppingItemRecord = {
      id: crypto.randomUUID(),
      name: name.toUpperCase(),
      priceCents: input.priceCents,
      productUrl: input.productUrl?.trim() || null,
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

  async updateWishlistItem(id: string, input: AddWishlistItemInput): Promise<ShoppingItemRecord> {
    const name = input.name.trim();
    if (!name) throw new Error('NOME OBRIGATÓRIO');
    if (!Number.isInteger(input.priceCents) || input.priceCents <= 0) {
      throw new Error('PREÇO DEVE SER MAIOR QUE ZERO');
    }
    if ((await this.getItem(id)).status !== 'WISHLIST') throw new Error('ITEM NÃO ESTÁ NA WISHLIST');
    return this.patch(id, {
      name: name.toUpperCase(),
      priceCents: input.priceCents,
      productUrl: input.productUrl?.trim() || null,
    });
  }

  async updateInTransitItem(id: string, input: UpdateInTransitInput): Promise<ShoppingItemRecord> {
    const name = input.name.trim();
    if (!name) throw new Error('NOME OBRIGATÓRIO');
    if (!Number.isInteger(input.priceCents) || input.priceCents <= 0) {
      throw new Error('PREÇO DEVE SER MAIOR QUE ZERO');
    }
    const storeApp = input.storeApp.trim();
    if (!storeApp) throw new Error('APP DA COMPRA OBRIGATÓRIO');
    const item = await this.getItem(id);
    if (item.status !== 'IN_TRANSIT') throw new Error('ITEM NÃO ESTÁ A CAMINHO');
    daysBetweenPureDates(item.purchasedAt!, input.estimatedDeliveryDate); // valida data
    return this.patch(id, {
      name: name.toUpperCase(),
      priceCents: input.priceCents,
      productUrl: input.productUrl?.trim() || null,
      storeApp: storeApp.toUpperCase(),
      estimatedDeliveryDate: input.estimatedDeliveryDate,
    });
  }

  async deleteItem(id: string): Promise<void> {
    await this.db.delete(schema.shoppingItems).where(eq(schema.shoppingItems.id, id));
  }

  async addPurchasedItem(input: AddPurchasedItemInput): Promise<ShoppingItemRecord> {
    const name = input.name.trim();
    if (!name) throw new Error('NOME OBRIGATÓRIO');
    if (!Number.isInteger(input.priceCents) || input.priceCents <= 0) {
      throw new Error('PREÇO DEVE SER MAIOR QUE ZERO');
    }
    const storeApp = input.storeApp.trim();
    if (!storeApp) throw new Error('APP DA COMPRA OBRIGATÓRIO');
    const purchasedAt = input.purchasedAt ?? toRecifeDateString();
    daysBetweenPureDates(purchasedAt, input.estimatedDeliveryDate); // valida datas

    if (!input.alreadyLoggedInFinances && !input.payment) {
      throw new Error('FORMA DE PAGAMENTO OBRIGATÓRIA');
    }

    const record: ShoppingItemRecord = {
      id: crypto.randomUUID(),
      name: name.toUpperCase(),
      priceCents: input.priceCents,
      productUrl: input.productUrl?.trim() || null,
      status: 'IN_TRANSIT',
      storeApp: storeApp.toUpperCase(),
      trackingUrl: null,
      purchasedAt,
      estimatedDeliveryDate: input.estimatedDeliveryDate,
      deliveredAt: null,
    };

    await this.db.transaction(async (tx) => {
      await tx.insert(schema.shoppingItems).values(record);

      if (!input.alreadyLoggedInFinances && input.payment) {
        await this.logInFinances(
          record,
          purchasedAt,
          input.payment,
          new FinancesService(tx as unknown as AppDatabase),
        );
      }
    });

    return record;
  }

  async markPurchased(id: string, input: MarkPurchasedInput): Promise<ShoppingItemRecord> {
    const item = await this.getItem(id);
    if (item.status !== 'WISHLIST') throw new Error('ITEM JÁ FOI COMPRADO');
    const storeApp = input.storeApp.trim();
    if (!storeApp) throw new Error('APP DA COMPRA OBRIGATÓRIO');
    const purchasedAt = input.purchasedAt ?? toRecifeDateString();
    daysBetweenPureDates(purchasedAt, input.estimatedDeliveryDate); // valida datas

    if (!input.alreadyLoggedInFinances) {
      if (!input.payment) throw new Error('FORMA DE PAGAMENTO OBRIGATÓRIA');
      await this.logInFinances(item, purchasedAt, input.payment, this.finances);
    }

    return this.patch(id, {
      status: 'IN_TRANSIT',
      storeApp: storeApp.toUpperCase(),
      purchasedAt,
      estimatedDeliveryDate: input.estimatedDeliveryDate,
    });
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

  async listInTransitView(today: string = toRecifeDateString()): Promise<InTransitView[]> {
    const { inTransit } = await this.listItemsBySection();
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

  async markDelivered(
    id: string,
    deliveredAt: string = toRecifeDateString(),
  ): Promise<ShoppingItemRecord> {
    if ((await this.getItem(id)).status !== 'IN_TRANSIT') throw new Error('ITEM NÃO ESTÁ A CAMINHO');
    return this.patch(id, { status: 'DELIVERED', deliveredAt });
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
