/**
 * ============================================================================
 * FICHIER : src/common/helpers/uuidv7.helper.ts
 * RÔLE : Générateur d'identifiants uniques universels chronologiques (UUIDv7).
 * EXPLICATION :
 * UUIDv7 est la norme retenue pour l'ensemble des clés primaires de la base de données :
 * 1. Les 48 premiers bits intègrent l'horodatage UNIX en millisecondes.
 * 2. Garantit un tri chronologique naturel et évite la fragmentation des B-Trees dans PostgreSQL.
 * 3. Permet la génération distribuée sans conflit entre les nœuds serveur.
 * ============================================================================
 */

import { v7 as uuidv7 } from 'uuid';

/**
 * Génère un nouvel identifiant UUIDv7 chronologique.
 *
 * @returns Une chaîne au format UUIDv7 (ex: "018b3d6f-7e8c-7123-89ab-cdef01234567").
 */
export function generateUuid(): string {
  return uuidv7();
}
