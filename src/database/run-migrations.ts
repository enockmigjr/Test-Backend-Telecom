import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import postgres from 'postgres';
import { DatabaseConfigService } from '../config/database.config';
import {
  assertBaselineCompatible,
  assertCurrentSchemaCompatible,
  assertLatestPublicInvariants,
  assertLatestSchemaCompatible,
  assertPublicExpandInvariants,
  assertPublicExpandSchemaCompatible,
  hasParentIntegrationGuards,
  hasPublicBootstrapGrants,
} from './migration-baseline.validator';

const BASELINE_MIGRATION_COUNT = 1;
const PUBLIC_EXPAND_MIGRATION_COUNT = 5;
const PUBLIC_BACKFILL_MIGRATION_COUNT = 6;
const OUTBOX_ENVELOPE_MIGRATION_COUNT = 8;
const PARENT_GUARD_MIGRATION_COUNT = 9;
const LATEST_MIGRATION_COUNT = 10;

export async function runMigrations(
  databaseUrl = new DatabaseConfigService().url,
  baselineExisting = false,
): Promise<void> {
  const client = postgres(databaseUrl, { max: 1 });
  try {
    if (baselineExisting) await baselineExistingSchema(client);
    await migrate(drizzle(client), { migrationsFolder: 'src/database/migrations' });
    process.stdout.write('Migrations appliquees avec succes.\n');
  } finally {
    await client.end();
  }
}

export async function baselineExistingSchema(client: postgres.Sql): Promise<void> {
  const migrations = readMigrationFiles({ migrationsFolder: 'src/database/migrations' });
  if (migrations.length < LATEST_MIGRATION_COUNT) {
    throw new Error('Catalogue de migrations incomplet.');
  }
  if (await hasPublicBootstrapGrants(client)) {
    await assertCurrentSchemaCompatible(client);
    const backfillComplete = await assertLatestPublicInvariants(client);
    const parentGuardsComplete = await hasParentIntegrationGuards(client);
    if (!backfillComplete || !parentGuardsComplete) {
      throw new Error('Schema 0009 partiellement migre; baseline refusee.');
    }
    await journalAppliedMigrations(client, migrations.slice(0, LATEST_MIGRATION_COUNT));
    return;
  }
  let appliedMigrations = migrations.slice(0, BASELINE_MIGRATION_COUNT);
  try {
    await assertLatestSchemaCompatible(client);
    const backfillComplete = await assertLatestPublicInvariants(client);
    const parentGuardsComplete = await hasParentIntegrationGuards(client);
    const bootstrapComplete = parentGuardsComplete && (await hasPublicBootstrapGrants(client));
    appliedMigrations = backfillComplete
      ? migrations.slice(
          0,
          bootstrapComplete
            ? LATEST_MIGRATION_COUNT
            : parentGuardsComplete
              ? PARENT_GUARD_MIGRATION_COUNT
              : OUTBOX_ENVELOPE_MIGRATION_COUNT,
        )
      : migrations.slice(0, PUBLIC_EXPAND_MIGRATION_COUNT);
  } catch {
    try {
      await assertPublicExpandSchemaCompatible(client);
      const backfillComplete = await assertPublicExpandInvariants(client);
      appliedMigrations = migrations.slice(
        0,
        backfillComplete ? PUBLIC_BACKFILL_MIGRATION_COUNT : PUBLIC_EXPAND_MIGRATION_COUNT,
      );
    } catch (publicError: unknown) {
      if (await hasPublicExpandArtifacts(client)) {
        const message = publicError instanceof Error ? publicError.message : String(publicError);
        throw new Error(`Schema public partiellement migre; baseline refusee. ${message}`);
      }
      await assertBaselineCompatible(client);
    }
  }
  await journalAppliedMigrations(client, appliedMigrations);
}

async function journalAppliedMigrations(
  client: postgres.Sql,
  migrations: ReturnType<typeof readMigrationFiles>,
): Promise<void> {
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
    if ((existing?.count ?? 0) > 0) return;
    for (const migration of migrations) {
      await transaction`
        INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES (${migration.hash}, ${migration.folderMillis})
      `;
    }
  });
}

async function hasPublicExpandArtifacts(client: postgres.Sql): Promise<boolean> {
  const [result] = await client<{ exists: boolean }[]>`
    SELECT to_regclass('public.support_integrations') IS NOT NULL
      OR EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'opened_by_user_id'
      ) AS exists
  `;
  return result?.exists ?? false;
}

if (require.main === module) {
  runMigrations(undefined, process.argv.includes('--baseline-existing')).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Echec des migrations: ${message}\n`);
    process.exitCode = 1;
  });
}
