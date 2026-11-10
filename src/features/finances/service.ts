import crypto from 'node:crypto';
import type { AppDatabase } from '@/db';
import { getDb } from '@/db';
import { toRecifeDateString } from '@/lib/dates';
import {
  buildNewCreditCard,
  buildNewInstallmentPlan,
  buildNewPayableBill,
  buildNewTransaction,
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
  UpdatePayableBillInput,
  UpdateTransactionInput,
} from './types';

export * from './types';

export class FinancesService {
  private readonly repo: FinancesRepository;

  constructor(db: AppDatabase = getDb()) {
    this.repo = new FinancesRepository(db);
  }

  createTransaction(input: CreateTransactionInput): TransactionRecord {
    const record = buildNewTransaction(input);
    this.repo.insertTransaction(record);
    return record;
  }

  updateTransaction(id: string, input: UpdateTransactionInput): TransactionRecord {
    const existing = this.repo.getTransactionById(id);
    if (!existing) throw new Error(`TRANSAÇÃO NÃO ENCONTRADA: ${id}`);
    const updated = buildUpdatedTransaction(existing, input);
    this.repo.updateTransaction(id, updated);
    return updated;
  }

  deleteTransaction(id: string): void {
    this.repo.deleteTransaction(id);
  }

  listTransactions(filters?: TransactionFilters): TransactionRecord[] {
    return filterTransactionsList(this.repo.getAllTransactions(), filters);
  }

  createPayableBill(input: CreatePayableBillInput): PayableBillRecord {
    const record = buildNewPayableBill(input);
    this.repo.insertPayableBill(record);
    return record;
  }

  updatePayableBill(id: string, input: UpdatePayableBillInput): PayableBillRecord {
    const existing = this.repo.getPayableBillById(id);
    if (!existing) throw new Error(`CONTA NÃO ENCONTRADA: ${id}`);
    const updated = buildUpdatedPayableBill(existing, input);
    this.repo.updatePayableBill(id, updated);

    const linkedTx = this.repo.getTransactionByBillId(id);
    if (linkedTx) {
      this.repo.updateTransaction(linkedTx.id, {
        ...linkedTx,
        description: updated.title,
        category: updated.category,
        amountCents: updated.amountCents,
      });
    }
    return updated;
  }

  markBillPaid(id: string, paidAtDate: string = toRecifeDateString()): PayableBillRecord {
    const bill = this.repo.getPayableBillById(id);
    if (!bill) throw new Error(`CONTA NÃO ENCONTRADA: ${id}`);
    const updated: PayableBillRecord = { ...bill, status: 'PAID', paidAt: paidAtDate };
    this.repo.updatePayableBill(id, updated);

    if (!this.repo.getTransactionByBillId(id)) {
      this.repo.insertTransaction({
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

  markBillPending(id: string): PayableBillRecord {
    const bill = this.repo.getPayableBillById(id);
    if (!bill) throw new Error(`CONTA NÃO ENCONTRADA: ${id}`);
    const updated: PayableBillRecord = { ...bill, status: 'PENDING', paidAt: null };
    this.repo.updatePayableBill(id, updated);
    this.repo.deleteTransactionsByBillId(id);
    return updated;
  }

  deletePayableBill(id: string): void {
    this.repo.deleteTransactionsByBillId(id);
    this.repo.deletePayableBill(id);
  }

  createCreditCard(input: CreateCreditCardInput): CreditCardRecord {
    const record = buildNewCreditCard(input);
    this.repo.insertCreditCard(record);
    return record;
  }

  deleteCreditCard(id: string): void {
    this.repo.deleteCreditCard(id);
  }

  listCreditCards(): CreditCardRecord[] {
    return this.repo.getAllCreditCards();
  }

  createInstallmentPlan(input: CreateInstallmentPlanInput): InstallmentPlanRecord {
    const record = buildNewInstallmentPlan(input);
    this.repo.insertInstallmentPlan(record);
    return record;
  }

  advanceInstallment(id: string): InstallmentPlanRecord {
    const existing = this.repo.getInstallmentPlanById(id);
    if (!existing) throw new Error(`PARCELAMENTO NÃO ENCONTRADO: ${id}`);
    const nextPaid = Math.min(existing.totalInstallments, existing.paidInstallments + 1);
    const updated: InstallmentPlanRecord = { ...existing, paidInstallments: nextPaid };
    this.repo.updateInstallmentPlan(id, updated);
    return updated;
  }

  deleteInstallmentPlan(id: string): void {
    this.repo.deleteInstallmentPlan(id);
  }

  listInstallmentPlans(): InstallmentPlanRecord[] {
    return this.repo.getAllInstallmentPlans();
  }

  listActiveInstallmentViews(): InstallmentPlanView[] {
    const cards = new Map(this.listCreditCards().map((c) => [c.id, c]));
    return this.listInstallmentPlans()
      .filter((p) => p.paidInstallments < p.totalInstallments)
      .map((p) => buildInstallmentView(p, cards));
  }

  private syncCreditCardBillsForMonth(competenceMonth: string): void {
    const cards = this.listCreditCards();
    const allPlans = this.listInstallmentPlans();
    const existingBills = this.repo.getAllPayableBills();

    for (const card of cards) {
      const cardTotal = computeCardInstallmentsTotal(card.id, allPlans, competenceMonth);
      const existing = existingBills.find(
        (b) =>
          b.billType === 'CREDIT_CARD_BILL' &&
          b.creditCardId === card.id &&
          b.competenceMonth === competenceMonth,
      );

      if (cardTotal > 0 && !existing) {
        this.createPayableBill({
          title: `FATURA ${card.name}`,
          billType: 'CREDIT_CARD_BILL',
          amountCents: cardTotal,
          category: 'CARTÃO DE CRÉDITO',
          dueDate: buildCardDueDate(competenceMonth, card.dueDay),
          competenceMonth,
          creditCardId: card.id,
        });
      } else if (existing && existing.status === 'PENDING') {
        if (cardTotal === 0) this.deletePayableBill(existing.id);
        else if (existing.amountCents !== cardTotal) {
          this.updatePayableBill(existing.id, { amountCents: cardTotal });
        }
      }
    }
  }

  listPayableBills(params?: { period?: FinancePeriod; referenceDate?: string }): PayableBillRecord[] {
    const prefix = getYearMonthPrefix(params?.period ?? 'ALL', params?.referenceDate);
    this.syncCreditCardBillsForMonth(prefix ?? toRecifeDateString().slice(0, 7));
    return filterBillsByPrefix(this.repo.getAllPayableBills(), prefix);
  }

  getBalanceSummary(params?: { period?: FinancePeriod; referenceDate?: string }): BalanceSummary {
    const period = params?.period ?? 'THIS_MONTH';
    const periodTxs = this.listTransactions({ period, referenceDate: params?.referenceDate });
    const pendingBills = this.listPayableBills({
      period,
      referenceDate: params?.referenceDate,
    }).filter((b) => b.status === 'PENDING');
    const month = getYearMonthPrefix(period, params?.referenceDate);
    return computeBalanceSummary(periodTxs, pendingBills, this.listInstallmentPlans(), month);
  }

  getHideBalance(): boolean {
    return this.repo.getHideBalance();
  }

  toggleHideBalance(): boolean {
    return this.repo.toggleHideBalance();
  }

  getDashboardView(filters?: TransactionFilters): FinancesDashboardView {
    const period = filters?.period ?? 'THIS_MONTH';
    const periodTxs = this.listTransactions({ period, referenceDate: filters?.referenceDate });
    const meta = computeDashboardMeta(periodTxs, this.repo.getAllTransactions());
    return {
      period,
      dateFilter: filters?.date ?? '',
      categoryFilter: filters?.category ?? '',
      transactions: this.listTransactions({ ...filters, period }),
      payableBills: this.listPayableBills({ period, referenceDate: filters?.referenceDate }),
      creditCards: this.listCreditCards(),
      installmentPlans: this.listActiveInstallmentViews(),
      ...meta,
      summary: this.getBalanceSummary({ period, referenceDate: filters?.referenceDate }),
      hideBalance: this.getHideBalance(),
    };
  }
}
