import { v7 as uuidv7 } from 'uuid';

/**
 * Génère un UUID v7 (triable chronologiquement).
 * UUID v7 encode le timestamp Unix en millisecondes dans les 48 premiers bits,
 * ce qui permet un tri naturel dans les index B-tree PostgreSQL.
 *
 * Utilisé pour TOUTES les clés primaires du système.
 */
export function generateUuid(): string {
  return uuidv7();
}
