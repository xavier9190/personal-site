import crypto from 'node:crypto';
import type { AppDatabase } from '@/db';
import { getDb } from '@/db';
import { toRecifeDateString } from '@/lib/dates';
import {
  buildNewCreditCard,
  buildNewInstallmentPlan,
  buildNewPayableBill,
  buildNewTransaction,
  buildUpdatedInstallmentPlan,
  buildUpdatedPayableBill,
  buildUpdatedTransaction,
} from './builders';
import {
  buildCardDueDate,
  buildInstallmentView,
  computeBalanceSummary,
  computeCardInstallmentsTotal,
  computeDashboardMeta,
  filterBillsByPrefix,
  filterTransactionsList,
  getYearMonthPrefix,
} from './helpers';
import { FinancesRepository } from './repository';
import type {
  BalanceSummary,
  CreateCreditCardInput,
  CreateInstallmentPlanInput,
  CreatePayableBillInput,
  CreateTransactionInput,
  CreditCardRecord,
  FinancePeriod,
  FinancesDashboardView,
  InstallmentPlanRecord,
  InstallmentPlanView,
  PayableBillRecord,
  TransactionFilters,
  TransactionRecord,
  UpdateInstallmentPlanInput,
  UpdatePayableBillInput,
  UpdateTransactionInput,
} from './types';

export * from './types';

export class FinancesService {
  private readonly repo: FinancesRepository;

  constructor(db: AppDatabase = getDb()) {
    this.repo = new FinancesRepository(db);
  }

  async createTransaction(input: CreateTransactionInput): Promise<TransactionRecord> {
    const record = buildNewTransaction(input);
    await this.repo.insertTransaction(record);
    return record;
  }

  async updateTransaction(id: string, input: UpdateTransactionInput): Promise<TransactionRecord> {
    const existing = await this.repo.getTransactionById(id);
    if (!existing) throw new Error(`TRANSAÇÃO NÃO ENCONTRADA: ${id}`);
    const updated = buildUpdatedTransaction(existing, input);
    await this.repo.updateTransaction(id, updated);
    return updated;
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.repo.deleteTransaction(id);
  }

  async listTransactions(filters?: TransactionFilters): Promise<TransactionRecord[]> {
    const all = await this.repo.getAllTransactions();
    return filterTransactionsList(all, filters);
  }

  async createPayableBill(input: CreatePayableBillInput): Promise<PayableBillRecord> {
    const record = buildNewPayableBill(input);
    await this.repo.insertPayableBill(record);
    return record;
  }

  async updatePayableBill(id: string, input: UpdatePayableBillInput): Promise<PayableBillRecord> {
    const existing = await this.repo.getPayableBillById(id);
    if (!existing) throw new Error(`CONTA NÃO ENCONTRADA: ${id}`);
    const updated = buildUpdatedPayableBill(existing, input);
    await this.repo.updatePayableBill(id, updated);

    const linkedTx = await this.repo.getTransactionByBillId(id);
    if (linkedTx) {
      await this.repo.updateTransaction(linkedTx.id, {
        ...linkedTx,
        description: updated.title,
        category: updated.category,
        amountCents: updated.amountCents,
      });
    }
    return updated;
  }

  async markBillPaid(
    id: string,
    paidAtDate: string = toRecifeDateString(),
  ): Promise<PayableBillRecord> {
    const bill = await this.repo.getPayableBillById(id);
    if (!bill) throw new Error(`CONTA NÃO ENCONTRADA: ${id}`);
    const updated: PayableBillRecord = { ...bill, status: 'PAID', paidAt: paidAtDate };
    await this.repo.updatePayableBill(id, updated);

    if (!(await this.repo.getTransactionByBillId(id))) {
      await this.repo.insertTransaction({
        id: crypto.randomUUID(),
        type: 'EXPENSE',
        description: bill.title,
        category: bill.category,
        amountCents: bill.amountCents,
        occurredAt: paidAtDate,
        status: 'PAID',
        payableBillId: bill.id,
        shoppingItemId: null,
      });
    }
    return updated;
  }

  async markBillPending(id: string): Promise<PayableBillRecord> {
    const bill = await this.repo.getPayableBillById(id);
    if (!bill) throw new Error(`CONTA NÃO ENCONTRADA: ${id}`);
    const updated: PayableBillRecord = { ...bill, status: 'PENDING', paidAt: null };
    await this.repo.updatePayableBill(id, updated);
    await this.repo.deleteTransactionsByBillId(id);
    return updated;
  }

  async deletePayableBill(id: string): Promise<void> {
    await this.repo.deleteTransactionsByBillId(id);
    await this.repo.deletePayableBill(id);
  }

  async createCreditCard(input: CreateCreditCardInput): Promise<CreditCardRecord> {
    const record = buildNewCreditCard(input);
    await this.repo.insertCreditCard(record);
    return record;
  }

  async deleteCreditCard(id: string): Promise<void> {
    await this.repo.deleteCreditCard(id);
  }

  async listCreditCards(): Promise<CreditCardRecord[]> {
    return this.repo.getAllCreditCards();
  }

  async createInstallmentPlan(input: CreateInstallmentPlanInput): Promise<InstallmentPlanRecord> {
    const record = buildNewInstallmentPlan(input);
    await this.repo.insertInstallmentPlan(record);
    return record;
  }

  async updateInstallmentPlan(
    id: string,
    input: UpdateInstallmentPlanInput,
  ): Promise<InstallmentPlanRecord> {
    const existing = await this.repo.getInstallmentPlanById(id);
    if (!existing) throw new Error(`PARCELAMENTO NÃO ENCONTRADO: ${id}`);
    const updated = buildUpdatedInstallmentPlan(existing, input);
    await this.repo.updateInstallmentPlan(id, updated);
    return updated;
  }

  async advanceInstallment(id: string): Promise<InstallmentPlanRecord> {
    const existing = await this.repo.getInstallmentPlanById(id);
    if (!existing) throw new Error(`PARCELAMENTO NÃO ENCONTRADO: ${id}`);
    const nextPaid = Math.min(existing.totalInstallments, existing.paidInstallments + 1);
    const updated: InstallmentPlanRecord = { ...existing, paidInstallments: nextPaid };
    await this.repo.updateInstallmentPlan(id, updated);
    return updated;
  }

  async deleteInstallmentPlan(id: string): Promise<void> {
    await this.repo.deleteInstallmentPlan(id);
  }

  async listInstallmentPlans(): Promise<InstallmentPlanRecord[]> {
    return this.repo.getAllInstallmentPlans();
  }

  async listActiveInstallmentViews(): Promise<InstallmentPlanView[]> {
    const [creditCards, plans] = await Promise.all([
      this.listCreditCards(),
      this.listInstallmentPlans(),
    ]);
    const cards = new Map(creditCards.map((c) => [c.id, c]));
    return plans
      .filter((p) => p.paidInstallments < p.totalInstallments)
      .map((p) => buildInstallmentView(p, cards));
  }

  private async syncCreditCardBillsForMonth(competenceMonth: string): Promise<void> {
    const [cards, allPlans, existingBills] = await Promise.all([
      this.listCreditCards(),
      this.listInstallmentPlans(),
      this.repo.getAllPayableBills(),
    ]);

    for (const card of cards) {
      const cardTotal = computeCardInstallmentsTotal(card.id, allPlans, competenceMonth);
      const existing = existingBills.find(
        (b) =>
          b.billType === 'CREDIT_CARD_BILL' &&
          b.creditCardId === card.id &&
          b.competenceMonth === competenceMonth,
      );

      if (cardTotal > 0 && !existing) {
        await this.createPayableBill({
          title: `FATURA ${card.name}`,
          billType: 'CREDIT_CARD_BILL',
          amountCents: cardTotal,
          category: 'CARTÃO DE CRÉDITO',
          dueDate: buildCardDueDate(competenceMonth, card.dueDay),
          competenceMonth,
          creditCardId: card.id,
        });
      } else if (existing && existing.status === 'PENDING') {
        if (cardTotal === 0) await this.deletePayableBill(existing.id);
        else if (existing.amountCents !== cardTotal) {
          await this.updatePayableBill(existing.id, { amountCents: cardTotal });
        }
      }
    }
  }

  private async syncFixedBillsForMonth(competenceMonth: string): Promise<void> {
    const fixed = (await this.repo.getAllPayableBills()).filter(
      (b) => b.billType === 'FIXED_RECURRING',
    );
    const latestByTitle = new Map<string, PayableBillRecord>();
    for (const bill of fixed) {
      const prev = latestByTitle.get(bill.title);
      if (!prev || bill.competenceMonth > prev.competenceMonth) latestByTitle.set(bill.title, bill);
    }
    for (const [title, latest] of latestByTitle) {
      const startedBefore = fixed.some(
        (b) => b.title === title && b.competenceMonth < competenceMonth,
      );
      const existsInMonth = fixed.some(
        (b) => b.title === title && b.competenceMonth === competenceMonth,
      );
      const hasEarlier = latest.competenceMonth < competenceMonth || startedBefore;
      if (existsInMonth || !hasEarlier) continue;
      await this.createPayableBill({
        title,
        billType: 'FIXED_RECURRING',
        amountCents: latest.amountCents,
        category: latest.category,
        dueDate: buildCardDueDate(competenceMonth, Number(latest.dueDate.slice(8, 10))),
        competenceMonth,
      });
    }
  }

  async listPayableBills(params?: {
    period?: FinancePeriod;
    referenceDate?: string;
  }): Promise<PayableBillRecord[]> {
    const prefix = getYearMonthPrefix(params?.period ?? 'ALL', params?.referenceDate);
    const month = prefix ?? toRecifeDateString().slice(0, 7);
    await this.syncCreditCardBillsForMonth(month);
    await this.syncFixedBillsForMonth(month);
    return filterBillsByPrefix(await this.repo.getAllPayableBills(), prefix);
  }

  async getBalanceSummary(params?: {
    period?: FinancePeriod;
    referenceDate?: string;
  }): Promise<BalanceSummary> {
    const period = params?.period ?? 'THIS_MONTH';
    const [periodTxs, allBills, installmentPlans] = await Promise.all([
      this.listTransactions({ period, referenceDate: params?.referenceDate }),
      this.listPayableBills({ period, referenceDate: params?.referenceDate }),
      this.listInstallmentPlans(),
    ]);
    const pendingBills = allBills.filter((b) => b.status === 'PENDING');
    const month = getYearMonthPrefix(period, params?.referenceDate);
    return computeBalanceSummary(periodTxs, pendingBills, installmentPlans, month);
  }

  async getHideBalance(): Promise<boolean> {
    return this.repo.getHideBalance();
  }

  async toggleHideBalance(): Promise<boolean> {
    return this.repo.toggleHideBalance();
  }

  async getDashboardView(filters?: TransactionFilters): Promise<FinancesDashboardView> {
    const period = filters?.period ?? 'THIS_MONTH';
    const [allTransactions, payableBills, creditCards, installmentPlans, hideBalance] =
      await Promise.all([
        this.repo.getAllTransactions(),
        this.listPayableBills({ period, referenceDate: filters?.referenceDate }),
        this.listCreditCards(),
        this.listActiveInstallmentViews(),
        this.getHideBalance(),
      ]);
    const periodTxs = filterTransactionsList(allTransactions, {
      period,
      referenceDate: filters?.referenceDate,
    });
    const meta = computeDashboardMeta(periodTxs, allTransactions);
    const filteredTransactions = filterTransactionsList(allTransactions, { ...filters, period });
    const summary = await this.getBalanceSummary({
      period,
      referenceDate: filters?.referenceDate,
    });

    return {
      period,
      dateFilter: filters?.date ?? '',
      categoryFilter: filters?.category ?? '',
      transactions: filteredTransactions,
      payableBills,
      creditCards,
      installmentPlans,
      ...meta,
      summary,
      hideBalance,
    };
  }
}
