import type { AppDatabase } from '@/db';
import { getDb } from '@/db';
import * as schema from './schema';

export class FinancesService {
  constructor(private readonly db: AppDatabase = getDb()) {}

  listTransactions() {
    return this.db.select().from(schema.transactions).all();
  }

  listInstallmentPlans() {
    return this.db.select().from(schema.installmentPlans).all();
  }

  listPayableBills() {
    return this.db.select().from(schema.payableBills).all();
  }
}
