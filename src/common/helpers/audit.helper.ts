/**
 * Colonnes d'audit standard pour les entités.
 * Pattern cohérent pour toutes les tables qui nécessitent une traçabilité.
 *
 * Règles:
 * - createdBy: toujours rempli à la création (userId)
 * - updatedBy: mis à jour à chaque modification (userId)
 * - deletedBy: rempli lors d'un soft delete (userId), null sinon
 * - createdAt/updatedAt: gérés automatiquement par PostgreSQL/Drizzle
 * - deletedAt: null par défaut, défini lors du soft delete
 */
export interface AuditFields {
  createdBy: string | null;
  updatedBy: string | null;
  deletedBy: string | null;
}

/**
 * Prépare les champs d'audit pour la création d'une entité.
 */
export function createAuditFields(userId?: string): AuditFields {
  return {
    createdBy: userId || null,
    updatedBy: null,
    deletedBy: null,
  };
}

/**
 * Prépare les champs d'audit pour la mise à jour d'une entité.
 */
export function updateAuditFields(userId?: string): Pick<AuditFields, 'updatedBy'> {
  return {
    updatedBy: userId || null,
  };
}

/**
 * Prépare les champs d'audit pour la suppression logique d'une entité.
 */
export function deleteAuditFields(userId?: string): { deletedAt: Date; deletedBy: string | null } {
  return {
    deletedAt: new Date(),
    deletedBy: userId || null,
  };
}
