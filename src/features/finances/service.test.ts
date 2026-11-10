import { describe, expect, it } from 'vitest';
import { createDbClient } from '@/db';
import { FinancesService } from './service';

describe('FinancesService seam (Transactions, Filters, Balance, Privacy)', () => {
  it('creates income and expense transactions in integer cents and computes exact balance', () => {
    const { db, close } = createDbClient(':memory:');
    const service = new FinancesService(db);

    try {
      service.createTransaction({
        type: 'INCOME',
        description: 'SALÁRIO',
        category: 'TRABALHO',
        amountCents: 15000, // R$ 150,00
        occurredAt: '2026-11-05',
        status: 'PAID',
      });

      service.createTransaction({
        type: 'EXPENSE',
        description: 'ALMOÇO',
        category: 'ALIMENTAÇÃO',
        amountCents: 5000, // R$ 50,00
        occurredAt: '2026-11-10',
        status: 'PAID',
      });

      const summary = service.getBalanceSummary({
        period: 'THIS_MONTH',
        referenceDate: '2026-11-10',
      });

      expect(summary.incomeCents).toBe(15000);
      expect(summary.expenseCents).toBe(5000);
      expect(summary.balanceCents).toBe(10000); // R$ 100,00
    } finally {
      close();
    }
  });

  it('updates and deletes transactions, recalculating balance immediately', () => {
    const { db, close } = createDbClient(':memory:');
    const service = new FinancesService(db);

    try {
      const income = service.createTransaction({
        type: 'INCOME',
        description: 'FREELANCE',
        category: 'TRABALHO',
        amountCents: 20000,
        occurredAt: '2026-11-01',
      });

      const expense = service.createTransaction({
        type: 'EXPENSE',
        description: 'UBER',
        category: 'TRANSPORTE',
        amountCents: 4500,
        occurredAt: '2026-11-02',
      });

      service.updateTransaction(expense.id, {
        amountCents: 6000,
        description: 'UBER AEROPORTO',
      });

      expect(
        service.getBalanceSummary({ period: 'THIS_MONTH', referenceDate: '2026-11-10' })
          .balanceCents,
      ).toBe(14000);

      service.deleteTransaction(income.id);

      expect(
        service.getBalanceSummary({ period: 'THIS_MONTH', referenceDate: '2026-11-10' })
          .balanceCents,
      ).toBe(-6000);
    } finally {
      close();
    }
  });

  it('filters transactions by period, exact date, and category, and toggles balance privacy persistence', () => {
    const { db, close } = createDbClient(':memory:');
    const service = new FinancesService(db);

    try {
      service.createTransaction({
        type: 'EXPENSE',
        description: 'ALMOÇO RESTAURANTE',
        category: 'ALIMENTAÇÃO',
        amountCents: 3500,
        occurredAt: '2026-11-10',
      });
      service.createTransaction({
        type: 'EXPENSE',
        description: 'CINEMA',
        category: 'LAZER',
        amountCents: 4000,
        occurredAt: '2026-11-12',
      });
      service.createTransaction({
        type: 'INCOME',
        description: 'BÔNUS OUTUBRO',
        category: 'TRABALHO',
        amountCents: 10000,
        occurredAt: '2026-10-20',
      });

      const thisMonth = service.listTransactions({
        period: 'THIS_MONTH',
        referenceDate: '2026-11-10',
      });
      expect(thisMonth).toHaveLength(2);

      const lastMonth = service.listTransactions({
        period: 'LAST_MONTH',
        referenceDate: '2026-11-10',
      });
      expect(lastMonth).toHaveLength(1);
      expect(lastMonth[0].description).toBe('BÔNUS OUTUBRO');

      const foodOnly = service.listTransactions({
        period: 'THIS_MONTH',
        referenceDate: '2026-11-10',
        category: 'ALIMENTAÇÃO',
      });
      expect(foodOnly).toHaveLength(1);
      expect(foodOnly[0].description).toBe('ALMOÇO RESTAURANTE');

      const exactDate = service.listTransactions({
        period: 'THIS_MONTH',
        referenceDate: '2026-11-10',
        date: '2026-11-12',
      });
      expect(exactDate).toHaveLength(1);
      expect(exactDate[0].description).toBe('CINEMA');

      const noMatches = service.listTransactions({
        period: 'THIS_MONTH',
        referenceDate: '2026-11-10',
        category: 'TRANSPORTE',
      });
      expect(noMatches).toHaveLength(0);

      // Privacy toggle persistence
      expect(service.getHideBalance()).toBe(false);
      expect(service.toggleHideBalance()).toBe(true);
      expect(service.getHideBalance()).toBe(true);
      expect(service.toggleHideBalance()).toBe(false);
    } finally {
      close();
    }
  });
});
