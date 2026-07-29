/**
 * ============================================================================
 * FICHIER : src/database/run-migrations.ts
 * RÔLE : Script d'exécution et d'alignement des migrations Drizzle ORM sur PostgreSQL.
 * EXPLICATION :
 * Ce script CLI (exécutable via `pnpm run db:migrate`) gère le schéma PostgreSQL :
 * 1. Applique les fichiers SQL du dossier `src/database/migrations` dans l'ordre chronologique.
 * 2. Si le drapeau `--baseline-existing` est transmis, vérifie la compatibilité de la base existante
 *    puis inscrit l'empreinte de la première migration dans la table `drizzle.__drizzle_migrations` sans la ré-exécuter.
 * 3. Ferme proprement le pool de connexion `postgres` en fin de traitement.
 * ============================================================================
 */

import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import postgres from 'postgres';
import { DatabaseConfigService } from '../config/database.config';
import { assertBaselineCompatible } from './migration-baseline.validator';

/**
 * Exécute l'ensemble des migrations SQL Drizzle pendant la phase de déploiement.
 *
 * @param databaseUrl URI de connexion à la base PostgreSQL.
 * @param baselineExisting Si `true`, marque la base existante comme à jour sans rejouer la 1ère migration.
 */
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
    process.stdout.write('Migrations appliquées avec succès.\n');
  } finally {
    await client.end();
  }
}

/**
 * Aligne la table système `drizzle.__drizzle_migrations` sur la base de données existante.
 *
 * @param client Instance SQL `postgres` active.
 */
export async function baselineExistingSchema(client: postgres.Sql): Promise<void> {
  // Validation stricte du schéma existant par rapport au snapshot
  await assertBaselineCompatible(client);

  const [baseline] = readMigrationFiles({ migrationsFolder: 'src/database/migrations' });
  if (!baseline) throw new Error('Migration baseline introuvable.');

  // Transaction atomique d'enregistrement du hash de baseline
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

// Exécution directe CLI si invoqué depuis la ligne de commande
if (require.main === module) {
  runMigrations(undefined, process.argv.includes('--baseline-existing')).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Échec des migrations: ${message}\n`);
    process.exitCode = 1;
  });
}
