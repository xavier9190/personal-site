import { describe, expect, it } from 'vitest';
import { createPgliteTestDb } from '@/db/pglite-test';
import { FinancesService } from './service';

describe('FinancesService seam (Transactions, Filters, Balance, Privacy)', () => {
  it('creates income and expense transactions in integer cents and computes exact balance', async () => {
    const { db, close } = await createPgliteTestDb();
    const service = new FinancesService(db);

    try {
      await service.createTransaction({
        type: 'INCOME',
        description: 'SALÁRIO',
        category: 'TRABALHO',
        amountCents: 15000, // R$ 150,00
        occurredAt: '2026-11-05',
        status: 'PAID',
      });

      await service.createTransaction({
        type: 'EXPENSE',
        description: 'ALMOÇO',
        category: 'ALIMENTAÇÃO',
        amountCents: 5000, // R$ 50,00
        occurredAt: '2026-11-10',
        status: 'PAID',
      });

      const summary = await service.getBalanceSummary({
        period: 'THIS_MONTH',
        referenceDate: '2026-11-10',
      });

      expect(summary.incomeCents).toBe(15000);
      expect(summary.expenseCents).toBe(5000);
      expect(summary.balanceCents).toBe(10000); // R$ 100,00
    } finally {
      await close();
    }
  });

  it('updates and deletes transactions, recalculating balance immediately', async () => {
    const { db, close } = await createPgliteTestDb();
    const service = new FinancesService(db);

    try {
      const income = await service.createTransaction({
        type: 'INCOME',
        description: 'FREELANCE',
        category: 'TRABALHO',
        amountCents: 20000,
        occurredAt: '2026-11-01',
      });

      const expense = await service.createTransaction({
        type: 'EXPENSE',
        description: 'UBER',
        category: 'TRANSPORTE',
        amountCents: 4500,
        occurredAt: '2026-11-02',
      });

      await service.updateTransaction(expense.id, {
        amountCents: 6000,
        description: 'UBER AEROPORTO',
      });

      expect(
        (await service.getBalanceSummary({ period: 'THIS_MONTH', referenceDate: '2026-11-10' }))
          .balanceCents,
      ).toBe(14000);

      await service.deleteTransaction(income.id);

      expect(
        (await service.getBalanceSummary({ period: 'THIS_MONTH', referenceDate: '2026-11-10' }))
          .balanceCents,
      ).toBe(-6000);
    } finally {
      await close();
    }
  });

  it('filters transactions by period, exact date, and category, and toggles balance privacy persistence', async () => {
    const { db, close } = await createPgliteTestDb();
    const service = new FinancesService(db);

    try {
      await service.createTransaction({
        type: 'EXPENSE',
        description: 'ALMOÇO RESTAURANTE',
        category: 'ALIMENTAÇÃO',
        amountCents: 3500,
        occurredAt: '2026-11-10',
      });
      await service.createTransaction({
        type: 'EXPENSE',
        description: 'CINEMA',
        category: 'LAZER',
        amountCents: 4000,
        occurredAt: '2026-11-12',
      });
      await service.createTransaction({
        type: 'INCOME',
        description: 'BÔNUS OUTUBRO',
        category: 'TRABALHO',
        amountCents: 10000,
        occurredAt: '2026-10-20',
      });

      const thisMonth = await service.listTransactions({
        period: 'THIS_MONTH',
        referenceDate: '2026-11-10',
      });
      expect(thisMonth).toHaveLength(2);

      const lastMonth = await service.listTransactions({
        period: 'LAST_MONTH',
        referenceDate: '2026-11-10',
      });
      expect(lastMonth).toHaveLength(1);
      expect(lastMonth[0].description).toBe('BÔNUS OUTUBRO');

      const foodOnly = await service.listTransactions({
        period: 'THIS_MONTH',
        referenceDate: '2026-11-10',
        category: 'ALIMENTAÇÃO',
      });
      expect(foodOnly).toHaveLength(1);
      expect(foodOnly[0].description).toBe('ALMOÇO RESTAURANTE');

      const exactDate = await service.listTransactions({
        period: 'THIS_MONTH',
        referenceDate: '2026-11-10',
        date: '2026-11-12',
      });
      expect(exactDate).toHaveLength(1);
      expect(exactDate[0].description).toBe('CINEMA');

      const noMatches = await service.listTransactions({
        period: 'THIS_MONTH',
        referenceDate: '2026-11-10',
        category: 'TRANSPORTE',
      });
      expect(noMatches).toHaveLength(0);

      // Privacy toggle persistence
      expect(await service.getHideBalance()).toBe(false);
      expect(await service.toggleHideBalance()).toBe(true);
      expect(await service.getHideBalance()).toBe(true);
      expect(await service.toggleHideBalance()).toBe(false);
    } finally {
      await close();
    }
  });

  it('manages Payable Bills (Fixed, Debt, Single), computes A Pagar (Faltam N contas) and Previsto, and settles bills into Saldo when marked PAID', async () => {
    const { db, close } = await createPgliteTestDb();
    const service = new FinancesService(db);

    try {
      await service.createTransaction({
        type: 'INCOME',
        description: 'SALÁRIO',
        category: 'TRABALHO',
        amountCents: 10000, // R$ 100,00
        occurredAt: '2026-11-01',
        status: 'PAID',
      });

      const internetBill = await service.createPayableBill({
        title: 'INTERNET',
        billType: 'FIXED_RECURRING',
        amountCents: 3000, // R$ 30,00
        category: 'MORADIA',
        dueDate: '2026-11-10',
        competenceMonth: '2026-11',
      });

      const debtBill = await service.createPayableBill({
        title: 'DEVO AO CAIO',
        billType: 'DEBT_TO_PERSON',
        amountCents: 2000, // R$ 20,00
        category: 'OUTROS',
        dueDate: '2026-11-15',
        competenceMonth: '2026-11',
      });

      const initialSummary = await service.getBalanceSummary({
        period: 'THIS_MONTH',
        referenceDate: '2026-11-10',
      });

      expect(initialSummary.balanceCents).toBe(10000); // R$ 100,00
      expect(initialSummary.toPayCents).toBe(5000); // R$ 50,00
      expect(initialSummary.pendingBillsCount).toBe(2);
      expect(initialSummary.forecastCents).toBe(5000); // 100,00 - 50,00 = 50,00

      // Mark INTERNET bill as PAID
      await service.markBillPaid(internetBill.id, '2026-11-10');

      const afterPayment = await service.getBalanceSummary({
        period: 'THIS_MONTH',
        referenceDate: '2026-11-10',
      });

      expect(afterPayment.balanceCents).toBe(7000); // 100,00 - 30,00 = 70,00
      expect(afterPayment.toPayCents).toBe(2000); // Only DEVO AO CAIO remains
      expect(afterPayment.pendingBillsCount).toBe(1);
      expect(afterPayment.forecastCents).toBe(5000); // Forecast stays consistent: 70,00 - 20,00 = 50,00

      // Revert back to PENDING (Falta Pagar)
      await service.markBillPending(internetBill.id);
      const afterRevert = await service.getBalanceSummary({
        period: 'THIS_MONTH',
        referenceDate: '2026-11-10',
      });
      expect(afterRevert.balanceCents).toBe(10000);
      expect(afterRevert.toPayCents).toBe(5000);
      expect(afterRevert.pendingBillsCount).toBe(2);

      await service.deletePayableBill(debtBill.id);
      expect(
        (await service.getBalanceSummary({ period: 'THIS_MONTH', referenceDate: '2026-11-10' }))
          .pendingBillsCount,
      ).toBe(1);
    } finally {
      await close();
    }
  });

  it('consolidates credit card installments into the monthly card bill without double counting in A Pagar, and formats Parcelas a Pagar as N/TOTAL — FALTAM X DE R$ Y,YY', async () => {
    const { db, close } = await createPgliteTestDb();
    const service = new FinancesService(db);

    try {
      const nubank = await service.createCreditCard({
        name: 'Nubank',
        closingDay: 8,
        dueDay: 15,
        limitCents: 500000,
      });

      // Installment 1 on Nubank: Monitor 144hz, 4 installments of R$ 144,00, 2 already paid
      const monitorPlan = await service.createInstallmentPlan({
        description: 'Monitor 144hz',
        category: 'COMPRAS',
        totalInstallments: 4,
        paidInstallments: 2,
        installmentAmountCents: 14400, // R$ 144,00
        creditCardId: nubank.id,
        startMonth: '2026-09',
      });

      // Installment 2 on Nubank: Mouse, 3 installments of R$ 50,00, 1 already paid
      const mousePlan = await service.createInstallmentPlan({
        description: 'Mouse',
        category: 'COMPRAS',
        totalInstallments: 3,
        paidInstallments: 1,
        installmentAmountCents: 5000, // R$ 50,00
        creditCardId: nubank.id,
        startMonth: '2026-10',
      });

      const activePlans = await service.listActiveInstallmentViews();
      expect(activePlans).toHaveLength(2);
      expect(activePlans[0].headerText).toBe('MONITOR 144HZ 2/4');
      expect(activePlans[0].subtitleText).toBe('FALTAM 2 DE R$ 144,00');
      expect(activePlans[0].remainingInstallments).toBe(2);
      expect(activePlans[0].creditCardName).toBe('NUBANK');

      // Check monthly Payable Bills for 2026-11: Nubank invoice should consolidate 144,00 + 50,00 = 194,00
      const bills = await service.listPayableBills({
        period: 'THIS_MONTH',
        referenceDate: '2026-11-10',
      });
      expect(bills).toHaveLength(1);
      expect(bills[0].billType).toBe('CREDIT_CARD_BILL');
      expect(bills[0].title).toBe('FATURA NUBANK');
      expect(bills[0].amountCents).toBe(19400); // R$ 194,00 consolidated
      expect(bills[0].dueDate).toBe('2026-11-15');

      // Summary should NOT double count the installments outside the card bill
      const summary = await service.getBalanceSummary({
        period: 'THIS_MONTH',
        referenceDate: '2026-11-10',
      });
      expect(summary.toPayCents).toBe(19400);
      expect(summary.pendingBillsCount).toBe(1);

      // Advance monitor installment to 3/4 and then 4/4 (completed)
      await service.advanceInstallment(monitorPlan.id);
      const afterOneStep = await service.listActiveInstallmentViews();
      const updatedMonitor = afterOneStep.find((p) => p.id === monitorPlan.id)!;
      expect(updatedMonitor.headerText).toBe('MONITOR 144HZ 3/4');
      expect(updatedMonitor.subtitleText).toBe('FALTAM 1 DE R$ 144,00');

      await service.advanceInstallment(monitorPlan.id); // 4/4 completed!
      const afterCompleted = await service.listActiveInstallmentViews();
      expect(afterCompleted.map((p) => p.id)).toEqual([mousePlan.id]);

      // Card invoice for 2026-11 now reflects only the active Mouse installment (R$ 50,00)
      const updatedSummary = await service.getBalanceSummary({
        period: 'THIS_MONTH',
        referenceDate: '2026-11-10',
      });
      expect(updatedSummary.toPayCents).toBe(5000);

      // Standalone installment plan (not linked to any card) adds directly to A Pagar
      await service.createInstallmentPlan({
        description: 'Curso Inglês',
        category: 'EDUCAÇÃO',
        totalInstallments: 6,
        paidInstallments: 2,
        installmentAmountCents: 20000, // R$ 200,00
        creditCardId: null,
        startMonth: '2026-09',
      });

      const withStandalone = await service.getBalanceSummary({
        period: 'THIS_MONTH',
        referenceDate: '2026-11-10',
      });
      expect(withStandalone.toPayCents).toBe(25000); // 50,00 (card bill) + 200,00 (standalone)
      expect(withStandalone.pendingBillsCount).toBe(2);

      // Installments only charge months within startMonth..startMonth+total-1
      const jan = await service.getBalanceSummary({ period: 'NEXT_MONTH', referenceDate: '2026-12-10' });
      expect(jan.toPayCents).toBe(20000); // Mouse ended 2026-12; only the course remains
      expect(jan.pendingBillsCount).toBe(1);
      const august = await service.getBalanceSummary({ period: 'LAST_MONTH', referenceDate: '2026-09-10' });
      expect(august.toPayCents).toBe(0); // nothing started yet in 2026-08
    } finally {
      await close();
    }
  });

  it('repeats FIXED_RECURRING bills every month as PENDING and counts unpaid ones in A Pagar', async () => {
    const { db, close } = await createPgliteTestDb();
    const service = new FinancesService(db);

    try {
      const bill = await service.createPayableBill({
        title: 'Plano Internet',
        billType: 'FIXED_RECURRING',
        amountCents: 5700,
        category: 'MORADIA',
        dueDate: '2026-11-10',
      });
      await service.markBillPaid(bill.id, '2026-11-10');

      const nov = await service.getBalanceSummary({ period: 'THIS_MONTH', referenceDate: '2026-11-10' });
      expect(nov.toPayCents).toBe(0);

      const dec = await service.listPayableBills({ period: 'NEXT_MONTH', referenceDate: '2026-11-10' });
      expect(dec).toHaveLength(1);
      expect(dec[0].status).toBe('PENDING');
      expect(dec[0].dueDate).toBe('2026-12-10');
      expect(
        (await service.getBalanceSummary({ period: 'NEXT_MONTH', referenceDate: '2026-11-10' })).toPayCents,
      ).toBe(5700);

      // never backfills before the first month
      expect(
        await service.listPayableBills({ period: 'LAST_MONTH', referenceDate: '2026-11-10' }),
      ).toHaveLength(0);
    } finally {
      await close();
    }
  });

  it('edits Payable Bills and keeps linked PAID transaction synchronized', async () => {
    const { db, close } = await createPgliteTestDb();
    const service = new FinancesService(db);

    try {
      await service.createTransaction({
        type: 'INCOME',
        description: 'SALÁRIO',
        category: 'TRABALHO',
        amountCents: 100000,
        occurredAt: '2026-11-01',
      });

      const bill = await service.createPayableBill({
        title: 'ENERGIA',
        billType: 'FIXED_RECURRING',
        amountCents: 15000,
        category: 'MORADIA',
        dueDate: '2026-11-12',
      });

      await service.markBillPaid(bill.id, '2026-11-12');
      expect(
        (await service.getBalanceSummary({ period: 'THIS_MONTH', referenceDate: '2026-11-12' }))
          .balanceCents,
      ).toBe(85000);

      // Edit the bill amount and title after it was marked PAID
      const edited = await service.updatePayableBill(bill.id, {
        title: 'ENERGIA CELPE',
        amountCents: 18000,
      });
      expect(edited.title).toBe('ENERGIA CELPE');
      expect(edited.amountCents).toBe(18000);

      // Balance should reflect the updated expense transaction (1000,00 - 180,00 = 820,00)
      expect(
        (await service.getBalanceSummary({ period: 'THIS_MONTH', referenceDate: '2026-11-12' }))
          .balanceCents,
      ).toBe(82000);
    } finally {
      await close();
    }
  });

  it('updates an existing installment plan correctly', async () => {
    const { db, close } = await createPgliteTestDb();
    const service = new FinancesService(db);

    try {
      const plan = await service.createInstallmentPlan({
        description: 'Placa de Vídeo',
        category: 'COMPRAS',
        totalInstallments: 10,
        paidInstallments: 1,
        installmentAmountCents: 35000,
        creditCardId: null,
        startMonth: '2026-10',
      });

      const updated = await service.updateInstallmentPlan(plan.id, {
        description: 'RTX 4070 SUPER',
        totalInstallments: 12,
        installmentAmountCents: 32000,
      });

      expect(updated.description).toBe('RTX 4070 SUPER');
      expect(updated.totalInstallments).toBe(12);
      expect(updated.installmentAmountCents).toBe(32000);
      expect(updated.paidInstallments).toBe(1);
    } finally {
      await close();
    }
  });

  it('computes getDashboardView and getHomeOverview consistently with single-round-trip bill syncing', async () => {
    const { db, close } = await createPgliteTestDb();
    const service = new FinancesService(db);

    try {
      await service.createTransaction({
        type: 'INCOME',
        description: 'SALÁRIO',
        category: 'TRABALHO',
        amountCents: 250000,
        occurredAt: '2026-10-05',
      });
      await service.createTransaction({
        type: 'EXPENSE',
        description: 'MERCADO',
        category: 'ALIMENTAÇÃO',
        amountCents: 35000,
        occurredAt: '2026-10-12',
      });

      const card = await service.createCreditCard({
        name: 'Nubank',
        closingDay: 8,
        dueDay: 15,
      });

      await service.createInstallmentPlan({
        description: 'Teclado',
        category: 'COMPRAS',
        totalInstallments: 4,
        paidInstallments: 1,
        installmentAmountCents: 12000,
        creditCardId: card.id,
        startMonth: '2026-09',
      });

      await service.createPayableBill({
        title: 'Internet',
        billType: 'FIXED_RECURRING',
        amountCents: 10000,
        category: 'MORADIA',
        dueDate: '2026-09-10',
        competenceMonth: '2026-09',
      });

      await service.toggleHideBalance();

      const view = await service.getDashboardView({
        period: 'THIS_MONTH',
        referenceDate: '2026-10-15',
      });
      const expectedBills = await service.listPayableBills({
        period: 'THIS_MONTH',
        referenceDate: '2026-10-15',
      });
      const expectedSummary = await service.getBalanceSummary({
        period: 'THIS_MONTH',
        referenceDate: '2026-10-15',
      });

      expect(view.transactions).toHaveLength(2);
      expect(view.payableBills).toEqual(expectedBills);
      expect(view.payableBills.map((b) => b.title).sort()).toEqual(['FATURA NUBANK', 'INTERNET']);
      expect(view.installmentPlans).toHaveLength(1);
      expect(view.installmentPlans[0].creditCardName).toBe('NUBANK');
      expect(view.summary).toEqual(expectedSummary);
      expect(view.summary.balanceCents).toBe(215000);
      expect(view.summary.toPayCents).toBe(22000);
      expect(view.summary.pendingBillsCount).toBe(2);
      expect(view.hideBalance).toBe(true);

      const home = await service.getHomeOverview('2026-10-15');
      expect(home.summary).toEqual(expectedSummary);
      expect(home.hideBalance).toBe(true);
      expect(home.allBills.map((b) => `${b.competenceMonth}:${b.title}`).sort()).toEqual([
        '2026-09:INTERNET',
        '2026-10:FATURA NUBANK',
        '2026-10:INTERNET',
      ]);
    } finally {
      await close();
    }
  });

  it('updates credit cards via updateCreditCard with canonical validation and rejects missing cards', async () => {
    const { db, close } = await createPgliteTestDb();
    const service = new FinancesService(db);

    try {
      const card = await service.createCreditCard({
        name: 'Nubank',
        closingDay: 8,
        dueDay: 15,
        limitCents: 300000,
      });

      const updated = await service.updateCreditCard(card.id, {
        name: 'Nubank Ultravioleta',
        closingDay: 10,
        dueDay: 20,
        limitCents: 800000,
      });

      expect(updated.id).toBe(card.id);
      expect(updated.name).toBe('NUBANK ULTRAVIOLETA');
      expect(updated.closingDay).toBe(10);
      expect(updated.dueDay).toBe(20);
      expect(updated.limitCents).toBe(800000);

      const clearedLimit = await service.updateCreditCard(card.id, {
        limitCents: null,
      });
      expect(clearedLimit.name).toBe('NUBANK ULTRAVIOLETA');
      expect(clearedLimit.limitCents).toBeNull();

      await expect(
        service.updateCreditCard(card.id, { closingDay: 32 }),
      ).rejects.toThrow();
      await expect(
        service.updateCreditCard(card.id, { name: '   ' }),
      ).rejects.toThrow();
      await expect(
        service.updateCreditCard('non-existent-card', { name: 'Inter' }),
      ).rejects.toThrow(/CARTÃO NÃO ENCONTRADO/);
    } finally {
      await close();
    }
  });
});
