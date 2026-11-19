import path from 'node:path';
import postgres, { type Sql } from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as pgSchema from './schema';

export type PgDatabase = PostgresJsDatabase<typeof pgSchema>;

export const PG_MIGRATIONS_FOLDER = path.join(process.cwd(), 'src', 'db', 'migrations-pg');

export interface PgClientOptions {
  max?: number;
}

export function createPgClient(
  connectionString: string = process.env.DATABASE_URL ?? '',
  options?: PgClientOptions,
): {
  db: PgDatabase;
  sql: Sql;
  close: () => Promise<void>;
} {
  if (!connectionString.trim()) {
    throw new Error('DATABASE_URL environment variable is required to connect to PostgreSQL.');
  }

  const sql = postgres(connectionString, {
    prepare: false,
    ...(options?.max !== undefined ? { max: options.max } : {}),
  });

  const db = drizzle(sql, { schema: pgSchema });

  return {
    db,
    sql,
    close: async () => {
      await sql.end();
    },
  };
}

let singletonPgClient: ReturnType<typeof createPgClient> | null = null;

export function getPgDb(): PgDatabase {
  if (!singletonPgClient) {
    singletonPgClient = createPgClient();
  }
  return singletonPgClient.db;
}
