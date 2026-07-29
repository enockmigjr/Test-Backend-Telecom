/**
 * ============================================================================
 * FICHIER : src/modules/auth/user-session-lock.ts
 * RÔLE : Verrou transactionnel d'avis PostgreSQL (Advisory Lock) pour la gestion des sessions utilisateur.
 * EXPLICATION :
 * Ce module garantit la sérialisation stricte des opérations concurrentes sur les jetons de rafraîchissement d'un utilisateur :
 * 1. Utilise la fonction PostgreSQL `pg_advisory_xact_lock` avec hachage 64 bits de l'ID utilisateur (`hashtextextended`).
 * 2. Empêche deux requêtes simultanées de rafraîchissement de jeton (ex: double-clic ou requêtes parallèles du frontend)
 *    de provoquer des incohérences de rotation de jeton ou des révocations abusives.
 * 3. Le verrou est automatiquement libéré à la fin de la transaction SQL sans nécessiter de déverrouillage manuel.
 * ============================================================================
 */

import { sql } from 'drizzle-orm';

import { DrizzleProvider } from '../../database/drizzle.provider';

/** Interface minimale du fournisseur de base de données permettant l'exécution de verrous SQL. */
type SessionLockDatabase = Pick<DrizzleProvider['db'], 'execute'>;

/**
 * Pose un verrou d'avis exclusif à l'échelle de la transaction PostgreSQL pour l'utilisateur spécifié.
 *
 * @param database Instance Drizzle ou transaction active.
 * @param userId Identifiant unique de l'utilisateur concerné par la modification de session.
 */
export async function acquireUserSessionLock(database: SessionLockDatabase, userId: string): Promise<void> {
  await database.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`);
}
