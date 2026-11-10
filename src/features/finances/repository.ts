import { eq } from 'drizzle-orm';
import type { AppDatabase } from '@/db';
import * as schema from './schema';
import type {
  CreditCardRecord,
  InstallmentPlanRecord,
  PayableBillRecord,
  TransactionRecord,
} from './types';

const DEFAULT_PREF_ID = 'default';

export class FinancesRepository {
  constructor(private readonly db: AppDatabase) {}

  insertTransaction(record: TransactionRecord): void {
    this.db.insert(schema.transactions).values(record).run();
  }

  getTransactionById(id: string): TransactionRecord | undefined {
    return this.db.select().from(schema.transactions).where(eq(schema.transactions.id, id)).get();
  }

  getTransactionByBillId(billId: string): TransactionRecord | undefined {
    return this.db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.payableBillId, billId))
      .get();
  }

  updateTransaction(id: string, record: TransactionRecord): void {
    this.db.update(schema.transactions).set(record).where(eq(schema.transactions.id, id)).run();
  }

  deleteTransaction(id: string): void {
    this.db.delete(schema.transactions).where(eq(schema.transactions.id, id)).run();
  }

  deleteTransactionsByBillId(billId: string): void {
    this.db.delete(schema.transactions).where(eq(schema.transactions.payableBillId, billId)).run();
  }

  getAllTransactions(): TransactionRecord[] {
    return this.db.select().from(schema.transactions).all();
  }

  insertPayableBill(record: PayableBillRecord): void {
    this.db.insert(schema.payableBills).values(record).run();
  }

  getPayableBillById(id: string): PayableBillRecord | undefined {
    return this.db.select().from(schema.payableBills).where(eq(schema.payableBills.id, id)).get();
  }

  updatePayableBill(id: string, record: PayableBillRecord): void {
    this.db.update(schema.payableBills).set(record).where(eq(schema.payableBills.id, id)).run();
  }

  deletePayableBill(id: string): void {
    this.db.delete(schema.payableBills).where(eq(schema.payableBills.id, id)).run();
  }

  getAllPayableBills(): PayableBillRecord[] {
    return this.db.select().from(schema.payableBills).all();
  }

  insertCreditCard(record: CreditCardRecord): void {
    this.db.insert(schema.creditCards).values(record).run();
  }

  deleteCreditCard(id: string): void {
    this.db.delete(schema.creditCards).where(eq(schema.creditCards.id, id)).run();
  }

  getAllCreditCards(): CreditCardRecord[] {
    return this.db.select().from(schema.creditCards).all();
  }

  insertInstallmentPlan(record: InstallmentPlanRecord): void {
    this.db.insert(schema.installmentPlans).values(record).run();
  }

  getInstallmentPlanById(id: string): InstallmentPlanRecord | undefined {
    return this.db
      .select()
      .from(schema.installmentPlans)
      .where(eq(schema.installmentPlans.id, id))
      .get();
  }

  updateInstallmentPlan(id: string, record: InstallmentPlanRecord): void {
    this.db
      .update(schema.installmentPlans)
      .set(record)
      .where(eq(schema.installmentPlans.id, id))
      .run();
  }

  deleteInstallmentPlan(id: string): void {
    this.db.delete(schema.installmentPlans).where(eq(schema.installmentPlans.id, id)).run();
  }

  getAllInstallmentPlans(): InstallmentPlanRecord[] {
    return this.db.select().from(schema.installmentPlans).all();
  }

  getHideBalance(): boolean {
    const row = this.db
      .select()
      .from(schema.financePreferences)
      .where(eq(schema.financePreferences.id, DEFAULT_PREF_ID))
      .get();
    return row?.hideBalance ?? false;
  }

  toggleHideBalance(): boolean {
    const existing = this.db
      .select()
      .from(schema.financePreferences)
      .where(eq(schema.financePreferences.id, DEFAULT_PREF_ID))
      .get();

    const nextValue = !(existing?.hideBalance ?? false);
    if (!existing) {
      this.db
        .insert(schema.financePreferences)
        .values({ id: DEFAULT_PREF_ID, hideBalance: nextValue })
        .run();
    } else {
      this.db
        .update(schema.financePreferences)
        .set({ hideBalance: nextValue })
        .where(eq(schema.financePreferences.id, DEFAULT_PREF_ID))
        .run();
    }
    return nextValue;
  }
}
