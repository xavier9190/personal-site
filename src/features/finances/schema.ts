import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { shoppingItems } from '@/features/shopping/schema';

export const creditCards = sqliteTable('credit_cards', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  closingDay: integer('closing_day').notNull(),
  dueDay: integer('due_day').notNull(),
  limitCents: integer('limit_cents'),
});

export const installmentPlans = sqliteTable('installment_plans', {
  id: text('id').primaryKey(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  totalInstallments: integer('total_installments').notNull(),
  paidInstallments: integer('paid_installments').notNull().default(0),
  installmentAmountCents: integer('installment_amount_cents').notNull(),
  creditCardId: text('credit_card_id').references(() => creditCards.id, {
    onDelete: 'set null',
  }),
  startMonth: text('start_month').notNull(),
  shoppingItemId: text('shopping_item_id').references(() => shoppingItems.id, {
    onDelete: 'set null',
  }),
});

export const payableBills = sqliteTable('payable_bills', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  billType: text('bill_type', {
    enum: ['FIXED_RECURRING', 'CREDIT_CARD_BILL', 'DEBT_TO_PERSON', 'SINGLE_BILL'],
  }).notNull(),
  amountCents: integer('amount_cents').notNull(),
  category: text('category').notNull(),
  dueDate: text('due_date').notNull(),
  competenceMonth: text('competence_month').notNull(),
  status: text('status', { enum: ['PENDING', 'PAID'] }).notNull().default('PENDING'),
  paidAt: text('paid_at'),
  creditCardId: text('credit_card_id').references(() => creditCards.id, {
    onDelete: 'set null',
  }),
});

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  type: text('type', { enum: ['INCOME', 'EXPENSE'] }).notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  amountCents: integer('amount_cents').notNull(),
  occurredAt: text('occurred_at').notNull(),
  status: text('status', { enum: ['PAID', 'PENDING'] }).notNull().default('PAID'),
  payableBillId: text('payable_bill_id').references(() => payableBills.id, {
    onDelete: 'set null',
  }),
  shoppingItemId: text('shopping_item_id').references(() => shoppingItems.id, {
    onDelete: 'set null',
  }),
});

export const financePreferences = sqliteTable('finance_preferences', {
  id: text('id').primaryKey(),
  hideBalance: integer('hide_balance', { mode: 'boolean' }).notNull().default(false),
});
