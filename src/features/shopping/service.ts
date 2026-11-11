import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { AppDatabase } from '@/db';
import { getDb } from '@/db';
import { FinancesService } from '@/features/finances/service';
import { daysBetweenPureDates, toRecifeDateString } from '@/lib/dates';
import * as schema from './schema';

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

export interface InTransitView extends ShoppingItemRecord {
  daysLeft: number;
  isOverdue: boolean;
  /** 0..1 do tempo decorrido entre compra e data estimada. */
  progress: number;
}

export class ShoppingService {
  private readonly finances: FinancesService;

  constructor(private readonly db: AppDatabase = getDb()) {
    this.finances = new FinancesService(db);
  }

  private getItem(id: string): ShoppingItemRecord {
    const item = this.db
      .select()
      .from(schema.shoppingItems)
      .where(eq(schema.shoppingItems.id, id))
      .get();
    if (!item) throw new Error(`ITEM NÃO ENCONTRADO: ${id}`);
    return item;
  }

  private patch(id: string, values: Partial<ShoppingItemRecord>): ShoppingItemRecord {
    this.db.update(schema.shoppingItems).set(values).where(eq(schema.shoppingItems.id, id)).run();
    return this.getItem(id);
  }

  listItemsBySection() {
    const all = this.db.select().from(schema.shoppingItems).all();
    return {
      wishlist: all.filter((item) => item.status === 'WISHLIST'),
      inTransit: all.filter((item) => item.status === 'IN_TRANSIT'),
      delivered: all.filter((item) => item.status === 'DELIVERED'),
    };
  }

  addWishlistItem(input: AddWishlistItemInput): ShoppingItemRecord {
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
    this.db.insert(schema.shoppingItems).values(record).run();
    return record;
  }

  updateWishlistItem(id: string, input: AddWishlistItemInput): ShoppingItemRecord {
    const name = input.name.trim();
    if (!name) throw new Error('NOME OBRIGATÓRIO');
    if (!Number.isInteger(input.priceCents) || input.priceCents <= 0) {
      throw new Error('PREÇO DEVE SER MAIOR QUE ZERO');
    }
    if (this.getItem(id).status !== 'WISHLIST') throw new Error('ITEM NÃO ESTÁ NA WISHLIST');
    return this.patch(id, {
      name: name.toUpperCase(),
      priceCents: input.priceCents,
      productUrl: input.productUrl?.trim() || null,
    });
  }

  updateInTransitItem(id: string, input: UpdateInTransitInput): ShoppingItemRecord {
    const name = input.name.trim();
    if (!name) throw new Error('NOME OBRIGATÓRIO');
    if (!Number.isInteger(input.priceCents) || input.priceCents <= 0) {
      throw new Error('PREÇO DEVE SER MAIOR QUE ZERO');
    }
    const storeApp = input.storeApp.trim();
    if (!storeApp) throw new Error('APP DA COMPRA OBRIGATÓRIO');
    const item = this.getItem(id);
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

  deleteItem(id: string): void {
    this.db.delete(schema.shoppingItems).where(eq(schema.shoppingItems.id, id)).run();
  }

  markPurchased(id: string, input: MarkPurchasedInput): ShoppingItemRecord {
    const item = this.getItem(id);
    if (item.status !== 'WISHLIST') throw new Error('ITEM JÁ FOI COMPRADO');
    const storeApp = input.storeApp.trim();
    if (!storeApp) throw new Error('APP DA COMPRA OBRIGATÓRIO');
    const purchasedAt = input.purchasedAt ?? toRecifeDateString();
    daysBetweenPureDates(purchasedAt, input.estimatedDeliveryDate); // valida datas

    if (!input.alreadyLoggedInFinances) {
      if (!input.payment) throw new Error('FORMA DE PAGAMENTO OBRIGATÓRIA');
      this.logInFinances(item, purchasedAt, input.payment);
    }

    return this.patch(id, {
      status: 'IN_TRANSIT',
      storeApp: storeApp.toUpperCase(),
      purchasedAt,
      estimatedDeliveryDate: input.estimatedDeliveryDate,
    });
  }

  private logInFinances(item: ShoppingItemRecord, purchasedAt: string, payment: PurchasePayment) {
    if (payment.mode === 'CASH') {
      this.finances.createTransaction({
        type: 'EXPENSE',
        description: item.name,
        category: 'COMPRAS',
        amountCents: item.priceCents,
        occurredAt: purchasedAt,
        shoppingItemId: item.id,
      });
      return;
    }
    this.finances.createInstallmentPlan({
      description: item.name,
      category: 'COMPRAS',
      totalInstallments: payment.totalInstallments,
      installmentAmountCents: Math.ceil(item.priceCents / payment.totalInstallments),
      startMonth: payment.startMonth,
      creditCardId: payment.creditCardId ?? null,
      shoppingItemId: item.id,
    });
  }

  listInTransitView(today: string = toRecifeDateString()): InTransitView[] {
    return this.listItemsBySection().inTransit.map((item) => {
      const estimated = item.estimatedDeliveryDate!;
      const total = daysBetweenPureDates(item.purchasedAt!, estimated);
      const elapsed = daysBetweenPureDates(item.purchasedAt!, today);
      const daysLeft = daysBetweenPureDates(today, estimated);
      const progress = total <= 0 ? 1 : Math.min(1, Math.max(0, elapsed / total));
      return { ...item, daysLeft, isOverdue: daysLeft < 0, progress };
    });
  }

  markDelivered(id: string, deliveredAt: string = toRecifeDateString()): ShoppingItemRecord {
    if (this.getItem(id).status !== 'IN_TRANSIT') throw new Error('ITEM NÃO ESTÁ A CAMINHO');
    return this.patch(id, { status: 'DELIVERED', deliveredAt });
  }

  revertDelivered(id: string): ShoppingItemRecord {
    if (this.getItem(id).status !== 'DELIVERED') throw new Error('ITEM NÃO FOI ENTREGUE');
    return this.patch(id, { status: 'IN_TRANSIT', deliveredAt: null });
  }

  revertToWishlist(id: string): ShoppingItemRecord {
    const item = this.getItem(id);
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
