import { sql } from 'drizzle-orm';

import { DrizzleProvider } from '../../database/drizzle.provider';

type SessionLockDatabase = Pick<DrizzleProvider['db'], 'execute'>;

/** Sérialise toutes les mutations de session d'un même utilisateur dans PostgreSQL. */
export async function acquireUserSessionLock(database: SessionLockDatabase, userId: string): Promise<void> {
  await database.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`);
}
