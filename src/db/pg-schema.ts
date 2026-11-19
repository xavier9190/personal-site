import { boolean, integer, pgTable, text } from 'drizzle-orm/pg-core';

export const calendarEvents = pgTable('calendar_events', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  startAt: text('start_at').notNull(),
  endAt: text('end_at').notNull(),
  allDay: boolean('all_day').notNull().default(false),
  color: text('color', { enum: ['green', 'red', 'blue', 'yellow'] }).notNull(),
  recurrenceRule: text('recurrence_rule', {
    enum: ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'],
  })
    .notNull()
    .default('NONE'),
  recurrenceUntil: text('recurrence_until'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const shoppingItems = pgTable('shopping_items', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  priceCents: integer('price_cents').notNull(),
  productUrl: text('product_url'),
  status: text('status', {
    enum: ['WISHLIST', 'IN_TRANSIT', 'DELIVERED'],
  }).notNull(),
  storeApp: text('store_app'),
  trackingUrl: text('tracking_url'),
  purchasedAt: text('purchased_at'),
  estimatedDeliveryDate: text('estimated_delivery_date'),
  deliveredAt: text('delivered_at'),
});

export const creditCards = pgTable('credit_cards', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  closingDay: integer('closing_day').notNull(),
  dueDay: integer('due_day').notNull(),
  limitCents: integer('limit_cents'),
});

export const installmentPlans = pgTable('installment_plans', {
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

export const payableBills = pgTable('payable_bills', {
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

export const transactions = pgTable('transactions', {
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

export const financePreferences = pgTable('finance_preferences', {
  id: text('id').primaryKey(),
  hideBalance: boolean('hide_balance').notNull().default(false),
});

export const academicProjects = pgTable('academic_projects', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  finalDeliveryDate: text('final_delivery_date'),
  groupMembers: text('group_members').notNull().default('[]'),
  status: text('status', { enum: ['PLANNED', 'IN_PROGRESS', 'COMPLETED'] })
    .notNull()
    .default('IN_PROGRESS'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const projectMilestones = pgTable('project_milestones', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => academicProjects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  dueDate: text('due_date').notNull(),
  isCompleted: boolean('is_completed').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const projectLinks = pgTable('project_links', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => academicProjects.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  url: text('url').notNull(),
});

export const chatThreads = pgTable('chat_threads', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const chatMessages = pgTable('chat_messages', {
  id: text('id').primaryKey(),
  threadId: text('thread_id')
    .notNull()
    .references(() => chatThreads.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['USER', 'ASSISTANT', 'SYSTEM'] }).notNull(),
  content: text('content').notNull(),
  attachmentsJson: text('attachments_json').notNull().default('[]'),
  toolCallsJson: text('tool_calls_json').notNull().default('[]'),
  createdAt: text('created_at').notNull(),
});

export const pendingToolActions = pgTable('pending_tool_actions', {
  id: text('id').primaryKey(),
  threadId: text('thread_id')
    .notNull()
    .references(() => chatThreads.id, { onDelete: 'cascade' }),
  toolName: text('tool_name').notNull(),
  argsJson: text('args_json').notNull(),
  status: text('status', {
    enum: ['PENDING_CONFIRMATION', 'CONFIRMED', 'CANCELLED', 'UNDONE'],
  }).notNull(),
  undoSnapshotJson: text('undo_snapshot_json'),
});

export const DOMAIN_TABLE_NAMES = [
  'calendar_events',
  'credit_cards',
  'installment_plans',
  'payable_bills',
  'transactions',
  'finance_preferences',
  'academic_projects',
  'project_milestones',
  'project_links',
  'shopping_items',
  'chat_threads',
  'chat_messages',
  'pending_tool_actions',
] as const;
