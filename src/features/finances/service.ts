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

  private async syncCreditCardBillsForMonth(
    competenceMonth: string,
    cards: CreditCardRecord[],
    allPlans: InstallmentPlanRecord[],
    existingBills: PayableBillRecord[],
  ): Promise<PayableBillRecord[]> {
    const bills = [...existingBills];

    for (const card of cards) {
      const cardTotal = computeCardInstallmentsTotal(card.id, allPlans, competenceMonth);
      const existingIdx = bills.findIndex(
        (b) =>
          b.billType === 'CREDIT_CARD_BILL' &&
          b.creditCardId === card.id &&
          b.competenceMonth === competenceMonth,
      );
      const existing = existingIdx >= 0 ? bills[existingIdx] : undefined;

      if (cardTotal > 0 && !existing) {
        const created = await this.createPayableBill({
          title: `FATURA ${card.name}`,
          billType: 'CREDIT_CARD_BILL',
          amountCents: cardTotal,
          category: 'CARTÃO DE CRÉDITO',
          dueDate: buildCardDueDate(competenceMonth, card.dueDay),
          competenceMonth,
          creditCardId: card.id,
        });
        bills.push(created);
      } else if (existing && existing.status === 'PENDING') {
        if (cardTotal === 0) {
          await this.deletePayableBill(existing.id);
          bills.splice(existingIdx, 1);
        } else if (existing.amountCents !== cardTotal) {
          const updated = await this.updatePayableBill(existing.id, { amountCents: cardTotal });
          bills[existingIdx] = updated;
        }
      }
    }

    return bills;
  }

  private async syncFixedBillsForMonth(
    competenceMonth: string,
    existingBills: PayableBillRecord[],
  ): Promise<PayableBillRecord[]> {
    const bills = [...existingBills];
    const fixed = bills.filter((b) => b.billType === 'FIXED_RECURRING');
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
      const created = await this.createPayableBill({
        title,
        billType: 'FIXED_RECURRING',
        amountCents: latest.amountCents,
        category: latest.category,
        dueDate: buildCardDueDate(competenceMonth, Number(latest.dueDate.slice(8, 10))),
        competenceMonth,
      });
      bills.push(created);
    }
    return bills;
  }

  private async syncBillsForMonth(
    competenceMonth: string,
    cards: CreditCardRecord[],
    allPlans: InstallmentPlanRecord[],
    existingBills: PayableBillRecord[],
  ): Promise<PayableBillRecord[]> {
    const afterCardSync = await this.syncCreditCardBillsForMonth(
      competenceMonth,
      cards,
      allPlans,
      existingBills,
    );
    return this.syncFixedBillsForMonth(competenceMonth, afterCardSync);
  }

  async listPayableBills(params?: {
    period?: FinancePeriod;
    referenceDate?: string;
  }): Promise<PayableBillRecord[]> {
    const prefix = getYearMonthPrefix(params?.period ?? 'ALL', params?.referenceDate);
    const month = prefix ?? toRecifeDateString().slice(0, 7);
    const [cards, allPlans, existingBills] = await Promise.all([
      this.listCreditCards(),
      this.listInstallmentPlans(),
      this.repo.getAllPayableBills(),
    ]);
    const syncedBills = await this.syncBillsForMonth(month, cards, allPlans, existingBills);
    return filterBillsByPrefix(syncedBills, prefix);
  }

  async getBalanceSummary(params?: {
    period?: FinancePeriod;
    referenceDate?: string;
  }): Promise<BalanceSummary> {
    const period = params?.period ?? 'THIS_MONTH';
    const prefix = getYearMonthPrefix(period, params?.referenceDate);
    const month = prefix ?? toRecifeDateString().slice(0, 7);
    const [allTxs, cards, allPlans, existingBills] = await Promise.all([
      this.repo.getAllTransactions(),
      this.listCreditCards(),
      this.listInstallmentPlans(),
      this.repo.getAllPayableBills(),
    ]);
    const syncedBills = await this.syncBillsForMonth(month, cards, allPlans, existingBills);
    const periodTxs = filterTransactionsList(allTxs, {
      period,
      referenceDate: params?.referenceDate,
    });
    const periodBills = filterBillsByPrefix(syncedBills, prefix);
    const pendingBills = periodBills.filter((b) => b.status === 'PENDING');
    return computeBalanceSummary(periodTxs, pendingBills, allPlans, prefix);
  }

  async getHideBalance(): Promise<boolean> {
    return this.repo.getHideBalance();
  }

  async toggleHideBalance(): Promise<boolean> {
    return this.repo.toggleHideBalance();
  }

  async getHomeOverview(referenceDate?: string): Promise<{
    summary: BalanceSummary;
    allBills: PayableBillRecord[];
    hideBalance: boolean;
  }> {
    const thisMonthPrefix = getYearMonthPrefix('THIS_MONTH', referenceDate);
    const month = thisMonthPrefix ?? toRecifeDateString().slice(0, 7);
    const [allTransactions, existingBills, cards, allPlans, hideBalance] = await Promise.all([
      this.repo.getAllTransactions(),
      this.repo.getAllPayableBills(),
      this.listCreditCards(),
      this.listInstallmentPlans(),
      this.getHideBalance(),
    ]);
    const syncedBills = await this.syncBillsForMonth(month, cards, allPlans, existingBills);
    const allBills = filterBillsByPrefix(syncedBills, null);
    const thisMonthBills = filterBillsByPrefix(syncedBills, thisMonthPrefix);
    const pendingThisMonthBills = thisMonthBills.filter((b) => b.status === 'PENDING');
    const periodTxs = filterTransactionsList(allTransactions, {
      period: 'THIS_MONTH',
      referenceDate,
    });
    const summary = computeBalanceSummary(
      periodTxs,
      pendingThisMonthBills,
      allPlans,
      thisMonthPrefix,
    );
    return { summary, allBills, hideBalance };
  }

  async getDashboardView(filters?: TransactionFilters): Promise<FinancesDashboardView> {
    const period = filters?.period ?? 'THIS_MONTH';
    const prefix = getYearMonthPrefix(period, filters?.referenceDate);
    const month = prefix ?? toRecifeDateString().slice(0, 7);
    const [allTransactions, existingBills, creditCards, allPlans, hideBalance] = await Promise.all([
      this.repo.getAllTransactions(),
      this.repo.getAllPayableBills(),
      this.listCreditCards(),
      this.listInstallmentPlans(),
      this.getHideBalance(),
    ]);
    const syncedBills = await this.syncBillsForMonth(month, creditCards, allPlans, existingBills);
    const payableBills = filterBillsByPrefix(syncedBills, prefix);
    const cardsById = new Map(creditCards.map((c) => [c.id, c]));
    const installmentPlans = allPlans
      .filter((p) => p.paidInstallments < p.totalInstallments)
      .map((p) => buildInstallmentView(p, cardsById));

    const periodTxs = filterTransactionsList(allTransactions, {
      period,
      referenceDate: filters?.referenceDate,
    });
    const meta = computeDashboardMeta(periodTxs, allTransactions);
    const filteredTransactions = filterTransactionsList(allTransactions, { ...filters, period });
    const pendingBills = payableBills.filter((b) => b.status === 'PENDING');
    const summary = computeBalanceSummary(periodTxs, pendingBills, allPlans, prefix);

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
