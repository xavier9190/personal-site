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

  async insertTransaction(record: TransactionRecord): Promise<void> {
    await this.db.insert(schema.transactions).values(record);
  }

  async getTransactionById(id: string): Promise<TransactionRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, id));
    return row;
  }

  async getTransactionByBillId(billId: string): Promise<TransactionRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.payableBillId, billId));
    return row;
  }

  async updateTransaction(id: string, record: TransactionRecord): Promise<void> {
    await this.db
      .update(schema.transactions)
      .set(record)
      .where(eq(schema.transactions.id, id));
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.db.delete(schema.transactions).where(eq(schema.transactions.id, id));
  }

  async deleteTransactionsByBillId(billId: string): Promise<void> {
    await this.db
      .delete(schema.transactions)
      .where(eq(schema.transactions.payableBillId, billId));
  }

  async getAllTransactions(): Promise<TransactionRecord[]> {
    return this.db.select().from(schema.transactions);
  }

  async insertPayableBill(record: PayableBillRecord): Promise<void> {
    await this.db.insert(schema.payableBills).values(record);
  }

  async getPayableBillById(id: string): Promise<PayableBillRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.payableBills)
      .where(eq(schema.payableBills.id, id));
    return row;
  }

  async updatePayableBill(id: string, record: PayableBillRecord): Promise<void> {
    await this.db
      .update(schema.payableBills)
      .set(record)
      .where(eq(schema.payableBills.id, id));
  }

  async deletePayableBill(id: string): Promise<void> {
    await this.db.delete(schema.payableBills).where(eq(schema.payableBills.id, id));
  }

  async getAllPayableBills(): Promise<PayableBillRecord[]> {
    return this.db.select().from(schema.payableBills);
  }

  async insertCreditCard(record: CreditCardRecord): Promise<void> {
    await this.db.insert(schema.creditCards).values(record);
  }

  async deleteCreditCard(id: string): Promise<void> {
    await this.db.delete(schema.creditCards).where(eq(schema.creditCards.id, id));
  }

  async getAllCreditCards(): Promise<CreditCardRecord[]> {
    return this.db.select().from(schema.creditCards);
  }

  async insertInstallmentPlan(record: InstallmentPlanRecord): Promise<void> {
    await this.db.insert(schema.installmentPlans).values(record);
  }

  async getInstallmentPlanById(id: string): Promise<InstallmentPlanRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.installmentPlans)
      .where(eq(schema.installmentPlans.id, id));
    return row;
  }

  async updateInstallmentPlan(id: string, record: InstallmentPlanRecord): Promise<void> {
    await this.db
      .update(schema.installmentPlans)
      .set(record)
      .where(eq(schema.installmentPlans.id, id));
  }

  async deleteInstallmentPlan(id: string): Promise<void> {
    await this.db
      .delete(schema.installmentPlans)
      .where(eq(schema.installmentPlans.id, id));
  }

  async getAllInstallmentPlans(): Promise<InstallmentPlanRecord[]> {
    return this.db.select().from(schema.installmentPlans);
  }

  async getHideBalance(): Promise<boolean> {
    const [row] = await this.db
      .select()
      .from(schema.financePreferences)
      .where(eq(schema.financePreferences.id, DEFAULT_PREF_ID));
    return row?.hideBalance ?? false;
  }

  async toggleHideBalance(): Promise<boolean> {
    const [existing] = await this.db
      .select()
      .from(schema.financePreferences)
      .where(eq(schema.financePreferences.id, DEFAULT_PREF_ID));

    const nextValue = !(existing?.hideBalance ?? false);
    if (!existing) {
      await this.db
        .insert(schema.financePreferences)
        .values({ id: DEFAULT_PREF_ID, hideBalance: nextValue });
    } else {
      await this.db
        .update(schema.financePreferences)
        .set({ hideBalance: nextValue })
        .where(eq(schema.financePreferences.id, DEFAULT_PREF_ID));
    }
    return nextValue;
  }
}
