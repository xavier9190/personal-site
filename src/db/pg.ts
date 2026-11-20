import path from 'node:path';
import { Pool, type PoolConfig } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as pgSchema from './schema';

export type PgDatabase = NodePgDatabase<typeof pgSchema>;

export const PG_MIGRATIONS_FOLDER = path.join(process.cwd(), 'src', 'db', 'migrations-pg');

export interface PgClientOptions {
  max?: number;
}

function shouldRequireSsl(connectionString: string): boolean {
  return (
    connectionString.includes('supabase.com') ||
    connectionString.includes('sslmode=require')
  );
}

export function createPgClient(
  connectionString: string = process.env.DATABASE_URL ?? '',
  options?: PgClientOptions,
): {
  db: PgDatabase;
  pool: Pool;
  close: () => Promise<void>;
} {
  const normalizedUrl = connectionString.trim();
  if (!normalizedUrl) {
    throw new Error('DATABASE_URL environment variable is required to connect to PostgreSQL.');
  }

  const poolConfig: PoolConfig = {
    connectionString: normalizedUrl,
    max: options?.max ?? 5,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 15_000,
    ...(shouldRequireSsl(normalizedUrl) ? { ssl: { rejectUnauthorized: false } } : {}),
  };

  const pool = new Pool(poolConfig);
  const db = drizzle(pool, { schema: pgSchema });

  return {
    db,
    pool,
    close: async () => {
      await pool.end();
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
