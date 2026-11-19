import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { getPgDb } from './pg';
import type * as schema from './schema';

export { createPgClient, getPgDb, PG_MIGRATIONS_FOLDER } from './pg';
export type { PgClientOptions, PgDatabase } from './pg';

export type AppDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

let dbOverride: AppDatabase | null = null;

export function setDbForTesting(db: AppDatabase | null): void {
  dbOverride = db;
}

export function getDb(): AppDatabase {
  if (dbOverride) {
    return dbOverride;
  }
  return getPgDb();
}
