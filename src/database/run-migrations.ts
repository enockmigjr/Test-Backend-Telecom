import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import postgres from 'postgres';
import { DatabaseConfigService } from '../config/database.config';
import { assertBaselineCompatible } from './migration-baseline.validator';

export async function runMigrations(
  databaseUrl = new DatabaseConfigService().url,
  baselineExisting = false,
): Promise<void> {
  const client = postgres(databaseUrl, { max: 1 });

  try {
    if (baselineExisting) {
      await baselineExistingSchema(client);
    }
    await migrate(drizzle(client), { migrationsFolder: 'src/database/migrations' });
    process.stdout.write('Migrations appliquees avec succes.\n');
  } finally {
    await client.end();
  }
}

export async function baselineExistingSchema(client: postgres.Sql): Promise<void> {
  await assertBaselineCompatible(client);

  const [baseline] = readMigrationFiles({ migrationsFolder: 'src/database/migrations' });
  if (!baseline) throw new Error('Migration baseline introuvable.');

  await client.begin(async (transaction) => {
    await transaction`CREATE SCHEMA IF NOT EXISTS drizzle`;
    await transaction`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `;
    const [existing] = await transaction<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM drizzle.__drizzle_migrations
    `;
    if ((existing?.count ?? 0) === 0) {
      await transaction`
        INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES (${baseline.hash}, ${baseline.folderMillis})
      `;
    }
  });
}

if (require.main === module) {
  runMigrations(undefined, process.argv.includes('--baseline-existing')).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Echec des migrations: ${message}\n`);
    process.exitCode = 1;
  });
}
