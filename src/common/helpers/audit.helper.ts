/**
 * Utilitaires d'audit pour les entités.
 *
 * NOTE ARCHITECTURALE :
 * La traçabilité fine des modifications (qui a modifié quoi et quand)
 * est gérée par la table `audit_logs` via AuditWorker + BullMQ.
 * Ces helpers préparent des objets partiels utilisés lors des insertions/updates
 * dans les services métier pour renseigner le champ `created_by` des tables
 * qui l'exposent (ex: tickets.createdBy).
 *
 * Règles :
 * - createdBy : rempli à la création (userId de l'auteur)
 * - Les actions UPDATE et DELETE sont tracées dans audit_logs, pas dans les tables métier
 */

/**
 * Prépare le champ d'audit pour la création d'une entité.
 * Utilisé pour renseigner `createdBy` lors d'une insertion.
 */
export function createAuditFields(userId: string): { createdBy: string } {
  return { createdBy: userId };
}

/**
 * Prépare un payload d'audit pour la mise à jour (à envoyer dans audit_logs).
 * Retourne un objet structuré prêt à être ajouté dans la queue AUDIT_QUEUE.
 */
export function buildUpdateAuditPayload(
  userId: string,
  entityType: string,
  entityId: string,
  oldValue: Record<string, unknown>,
  newValue: Record<string, unknown>,
): AuditPayload {
  return { userId, action: 'UPDATED', entityType, entityId, oldValue, newValue };
}

/**
 * Prépare un payload d'audit pour la suppression logique (soft delete).
 */
export function buildDeleteAuditPayload(userId: string, entityType: string, entityId: string): AuditPayload {
  return {
    userId,
    action: 'DELETED',
    entityType,
    entityId,
    oldValue: null,
    newValue: { deletedAt: new Date().toISOString() },
  };
}

/** Type du payload à envoyer dans la queue audit */
export interface AuditPayload {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
}
