import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { PG_MIGRATIONS_FOLDER } from './pg';
import * as pgSchema from './pg-schema';

export type PgliteTestDatabase = PgliteDatabase<typeof pgSchema>;

export interface PgliteTestDbOptions {
  beforeMigrate?: (client: PGlite) => Promise<void>;
}

export async function createPgliteTestDb(options?: PgliteTestDbOptions): Promise<{
  db: PgliteTestDatabase;
  client: PGlite;
  close: () => Promise<void>;
}> {
  const client = new PGlite();

  if (options?.beforeMigrate) {
    await options.beforeMigrate(client);
  }

  const db = drizzle(client, { schema: pgSchema });
  await migrate(db, { migrationsFolder: PG_MIGRATIONS_FOLDER });

  return {
    db,
    client,
    close: async () => {
      await client.close();
    },
  };
}
