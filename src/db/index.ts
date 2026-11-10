import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

export type AppDatabase = BetterSQLite3Database<typeof schema>;

const BOOTSTRAP_DDL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  all_day INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL,
  recurrence_rule TEXT NOT NULL DEFAULT 'NONE',
  recurrence_until TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shopping_items (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  product_url TEXT,
  status TEXT NOT NULL,
  store_app TEXT,
  tracking_url TEXT,
  purchased_at TEXT,
  estimated_delivery_date TEXT,
  delivered_at TEXT
);

CREATE TABLE IF NOT EXISTS credit_cards (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  closing_day INTEGER NOT NULL,
  due_day INTEGER NOT NULL,
  limit_cents INTEGER
);

CREATE TABLE IF NOT EXISTS installment_plans (
  id TEXT PRIMARY KEY NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  total_installments INTEGER NOT NULL,
  paid_installments INTEGER NOT NULL DEFAULT 0,
  installment_amount_cents INTEGER NOT NULL,
  credit_card_id TEXT REFERENCES credit_cards(id) ON DELETE SET NULL,
  start_month TEXT NOT NULL,
  shopping_item_id TEXT REFERENCES shopping_items(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS payable_bills (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  bill_type TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  category TEXT NOT NULL,
  due_date TEXT NOT NULL,
  competence_month TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  paid_at TEXT,
  credit_card_id TEXT REFERENCES credit_cards(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  occurred_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PAID',
  payable_bill_id TEXT REFERENCES payable_bills(id) ON DELETE SET NULL,
  shopping_item_id TEXT REFERENCES shopping_items(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS finance_preferences (
  id TEXT PRIMARY KEY NOT NULL,
  hide_balance INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS academic_projects (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  final_delivery_date TEXT,
  group_members TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_milestones (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES academic_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date TEXT NOT NULL,
  is_completed INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS project_links (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES academic_projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  url TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_threads (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY NOT NULL,
  thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  attachments_json TEXT NOT NULL DEFAULT '[]',
  tool_calls_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pending_tool_actions (
  id TEXT PRIMARY KEY NOT NULL,
  thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  args_json TEXT NOT NULL,
  status TEXT NOT NULL,
  undo_snapshot_json TEXT
);
`;

export function createDbClient(
  dbPath: string = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'personal.db'),
): {
  db: AppDatabase;
  sqlite: Database.Database;
  close: () => void;
} {
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const sqlite = new Database(dbPath);
  if (dbPath !== ':memory:') {
    sqlite.pragma('journal_mode = WAL');
  }
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(BOOTSTRAP_DDL);

  const db = drizzle(sqlite, { schema });

  return {
    db,
    sqlite,
    close: () => sqlite.close(),
  };
}

let singletonClient: ReturnType<typeof createDbClient> | null = null;

export function getDb(): AppDatabase {
  if (!singletonClient) {
    singletonClient = createDbClient();
  }
  return singletonClient.db;
}
