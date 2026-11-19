import { describe, expect, it } from 'vitest';
import { createDbClient } from '@/db';
import { FinancesService } from '@/features/finances/service';
import { ShoppingService } from './service';

function setup() {
  const { db, close } = createDbClient(':memory:');
  return {
    close,
    finances: new FinancesService(db),
    shopping: new ShoppingService(db),
  };
}

describe('ShoppingService seam (Wishlist, Comprei ✓ → Finanças, A Caminho, Chegou!)', () => {
  it('adds a wishlist item and lists it under wishlist', () => {
    const { shopping, close } = setup();
    try {
      const item = shopping.addWishlistItem({
        name: 'Teclado Mecânico',
        priceCents: 35000,
        productUrl: 'https://loja.com/teclado',
      });
      const { wishlist, inTransit } = shopping.listItemsBySection();
      expect(wishlist.map((i) => i.id)).toEqual([item.id]);
      expect(wishlist[0].name).toBe('TECLADO MECÂNICO');
      expect(inTransit).toHaveLength(0);
    } finally {
      close();
    }
  });

  it('edits a wishlist item and deletes it', () => {
    const { shopping, close } = setup();
    try {
      const item = shopping.addWishlistItem({ name: 'Teclado', priceCents: 30000 });
      const updated = shopping.updateWishlistItem(item.id, {
        name: 'Teclado Mecânico',
        priceCents: 35000,
        productUrl: 'https://loja.com/t',
      });
      expect(updated).toMatchObject({
        name: 'TECLADO MECÂNICO',
        priceCents: 35000,
        productUrl: 'https://loja.com/t',
      });
      expect(() => shopping.updateWishlistItem(item.id, { name: ' ', priceCents: 1 })).toThrow();

      shopping.deleteItem(item.id);
      expect(shopping.listItemsBySection().wishlist).toHaveLength(0);
    } finally {
      close();
    }
  });

  it('Comprei ✓ with [SIM] moves item to in-transit without touching Finanças', () => {
    const { shopping, finances, close } = setup();
    try {
      const item = shopping.addWishlistItem({ name: 'Mouse', priceCents: 12000 });
      shopping.markPurchased(item.id, {
        storeApp: 'Mercado Livre',
        estimatedDeliveryDate: '2026-11-20',
        purchasedAt: '2026-11-11',
        alreadyLoggedInFinances: true,
      });
      const { wishlist, inTransit } = shopping.listItemsBySection();
      expect(wishlist).toHaveLength(0);
      expect(inTransit[0].storeApp).toBe('MERCADO LIVRE');
      expect(finances.listTransactions()).toHaveLength(0);
      expect(finances.listInstallmentPlans()).toHaveLength(0);
    } finally {
      close();
    }
  });

  it('Comprei ✓ with [NÃO] + à vista creates an expense transaction in Finanças', () => {
    const { shopping, finances, close } = setup();
    try {
      const item = shopping.addWishlistItem({ name: 'Mouse', priceCents: 12000 });
      shopping.markPurchased(item.id, {
        storeApp: 'Shopee',
        estimatedDeliveryDate: '2026-11-20',
        purchasedAt: '2026-11-11',
        alreadyLoggedInFinances: false,
        payment: { mode: 'CASH' },
      });
      const txs = finances.listTransactions();
      expect(txs).toHaveLength(1);
      expect(txs[0]).toMatchObject({
        type: 'EXPENSE',
        amountCents: 12000,
        occurredAt: '2026-11-11',
        shoppingItemId: item.id,
      });
    } finally {
      close();
    }
  });

  it('Comprei ✓ with [NÃO] + parcelado creates an installment plan in Finanças', () => {
    const { shopping, finances, close } = setup();
    try {
      const item = shopping.addWishlistItem({ name: 'Monitor', priceCents: 120000 });
      shopping.markPurchased(item.id, {
        storeApp: 'AliExpress',
        estimatedDeliveryDate: '2026-12-01',
        purchasedAt: '2026-11-11',
        alreadyLoggedInFinances: false,
        payment: { mode: 'INSTALLMENTS', totalInstallments: 6, startMonth: '2026-12' },
      });
      const plans = finances.listInstallmentPlans();
      expect(plans).toHaveLength(1);
      expect(plans[0]).toMatchObject({
        totalInstallments: 6,
        installmentAmountCents: 20000,
        shoppingItemId: item.id,
      });
      expect(finances.listTransactions()).toHaveLength(0);
    } finally {
      close();
    }
  });

  it('computes days left, progress and overdue (!) for in-transit items', () => {
    const { shopping, close } = setup();
    try {
      const a = shopping.addWishlistItem({ name: 'A', priceCents: 100 });
      shopping.markPurchased(a.id, {
        storeApp: 'Shopee',
        purchasedAt: '2026-11-10',
        estimatedDeliveryDate: '2026-11-20',
        alreadyLoggedInFinances: true,
      });
      const b = shopping.addWishlistItem({ name: 'B', priceCents: 100 });
      shopping.markPurchased(b.id, {
        storeApp: 'Shopee',
        purchasedAt: '2026-11-01',
        estimatedDeliveryDate: '2026-11-05',
        alreadyLoggedInFinances: true,
      });
      const c = shopping.addWishlistItem({ name: 'C', priceCents: 100 });
      shopping.markPurchased(c.id, {
        storeApp: 'Shopee',
        purchasedAt: '2026-11-01',
        estimatedDeliveryDate: '2026-11-12',
        alreadyLoggedInFinances: true,
      });

      const view = shopping.listInTransitView('2026-11-15');
      const va = view.find((v) => v.id === a.id)!;
      const vb = view.find((v) => v.id === b.id)!;
      const vc = view.find((v) => v.id === c.id)!;
      expect(va).toMatchObject({
        estimatedDeliveryWindowEnd: '2026-11-25',
        daysLeft: 5,
        daysLeftToWindowEnd: 10,
        isInDeliveryWindow: false,
        isOverdue: false,
        progress: 0.5,
      });
      expect(vb).toMatchObject({
        estimatedDeliveryWindowEnd: '2026-11-10',
        daysLeft: -10,
        daysLeftToWindowEnd: -5,
        isInDeliveryWindow: false,
        isOverdue: true,
        progress: 1,
      });
      expect(vc).toMatchObject({
        estimatedDeliveryWindowEnd: '2026-11-17',
        daysLeft: -3,
        daysLeftToWindowEnd: 2,
        isInDeliveryWindow: true,
        isOverdue: false,
        progress: 1,
      });
    } finally {
      close();
    }
  });

  it('Chegou! archives the item into delivered history and can be reverted', () => {
    const { shopping, close } = setup();
    try {
      const item = shopping.addWishlistItem({ name: 'Cabo', priceCents: 2000 });
      shopping.markPurchased(item.id, {
        storeApp: 'Shopee',
        purchasedAt: '2026-11-10',
        estimatedDeliveryDate: '2026-11-20',
        alreadyLoggedInFinances: true,
      });

      shopping.markDelivered(item.id, '2026-11-18');
      let s = shopping.listItemsBySection();
      expect(s.inTransit).toHaveLength(0);
      expect(s.delivered[0]).toMatchObject({ id: item.id, deliveredAt: '2026-11-18' });

      shopping.revertDelivered(item.id);
      s = shopping.listItemsBySection();
      expect(s.delivered).toHaveLength(0);
      expect(s.inTransit.map((i) => i.id)).toEqual([item.id]);
      expect(s.inTransit[0].deliveredAt).toBeNull();

      shopping.revertToWishlist(item.id);
      s = shopping.listItemsBySection();
      expect(s.inTransit).toHaveLength(0);
      expect(s.wishlist.map((i) => i.id)).toEqual([item.id]);
      expect(s.wishlist[0].status).toBe('WISHLIST');
      expect(s.wishlist[0].purchasedAt).toBeNull();
      expect(s.wishlist[0].storeApp).toBeNull();
    } finally {
      close();
    }
  });

  it('adds an already-purchased item directly to in-transit without going through wishlist', () => {
    const { shopping, finances, close } = setup();
    try {
      const directCash = shopping.addPurchasedItem({
        name: 'Fone Bluetooth',
        priceCents: 25000,
        productUrl: 'https://loja.com/fone',
        storeApp: 'Amazon',
        purchasedAt: '2026-11-11',
        estimatedDeliveryDate: '2026-11-18',
        alreadyLoggedInFinances: false,
        payment: { mode: 'CASH' },
      });

      const directLogged = shopping.addPurchasedItem({
        name: 'Suporte Notebook',
        priceCents: 9000,
        storeApp: 'Shopee',
        purchasedAt: '2026-11-11',
        estimatedDeliveryDate: '2026-11-20',
        alreadyLoggedInFinances: true,
      });

      const { wishlist, inTransit } = shopping.listItemsBySection();
      expect(wishlist).toHaveLength(0);
      expect(inTransit.map((i) => i.id)).toEqual([directCash.id, directLogged.id]);
      expect(inTransit[0]).toMatchObject({
        name: 'FONE BLUETOOTH',
        storeApp: 'AMAZON',
        status: 'IN_TRANSIT',
      });

      const txs = finances.listTransactions();
      expect(txs).toHaveLength(1);
      expect(txs[0]).toMatchObject({
        amountCents: 25000,
        shoppingItemId: directCash.id,
      });

      // Validation error must not leave orphan item
      expect(() =>
        shopping.addPurchasedItem({
          name: 'Sem Pagamento',
          priceCents: 1000,
          storeApp: 'Shopee',
          purchasedAt: '2026-11-11',
          estimatedDeliveryDate: '2026-11-20',
          alreadyLoggedInFinances: false,
        }),
      ).toThrow(/FORMA DE PAGAMENTO/);
      expect(shopping.listItemsBySection().inTransit).toHaveLength(2);
    } finally {
      close();
    }
  });
});
