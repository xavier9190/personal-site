import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createPgClient, PG_MIGRATIONS_FOLDER } from '../src/db/pg';

export async function runPgMigrations(
  databaseUrl: string = process.env.DATABASE_URL ?? '',
): Promise<void> {
  const { db, close } = createPgClient(databaseUrl, { max: 1 });
  try {
    await migrate(db, { migrationsFolder: PG_MIGRATIONS_FOLDER });
  } finally {
    await close();
  }
}

const isCliEntrypoint =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isCliEntrypoint) {
  runPgMigrations()
    .then(() => {
      console.log('PostgreSQL migrations applied successfully.');
    })
    .catch((error: unknown) => {
      console.error('Failed to apply PostgreSQL migrations:', error);
      process.exitCode = 1;
    });
}
