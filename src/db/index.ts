import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

export type AppDatabase = BetterSQLite3Database<typeof schema>;

const MIGRATIONS_FOLDER = path.join(process.cwd(), 'src', 'db', 'migrations');

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

  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

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
