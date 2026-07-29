/**
 * ============================================================================
 * FICHIER : src/common/helpers/audit.helper.ts
 * RÔLE : Utilitaires de construction des payloads d'audit et de traçabilité immuable.
 * EXPLICATION :
 * Ce module fournit des fonctions helpers pour formater les données d'audit de sécurité :
 * 1. `createAuditFields` : Prépare le champ `createdBy` lors de la création d'une ressource.
 * 2. `buildUpdateAuditPayload` : Formate un événement de modification pour la file d'attente `AUDIT_QUEUE` BullMQ.
 * 3. `buildDeleteAuditPayload` : Formate un événement de suppression logique (soft delete).
 * ============================================================================
 */

/**
 * Interface représentant la structure d'un payload d'audit transmis à la file d'attente BullMQ `audit-queue`.
 */
export interface AuditPayload {
  /** Identifiant de l'utilisateur ayant exécuté l'action. */
  userId: string;
  /** Libellé de l'action exécutée ('CREATED', 'UPDATED', 'DELETED'). */
  action: string;
  /** Type d'entité concernée (ex: 'ticket', 'user', 'department'). */
  entityType: string;
  /** Identifiant de l'entité concernée. */
  entityId: string;
  /** Instantané des attributs avant modification (ou `null` si création). */
  oldValue: Record<string, unknown> | null;
  /** Instantané des attributs après modification (ou `null` si suppression). */
  newValue: Record<string, unknown> | null;
}

/**
 * Prépare l'objet d'audit de création contenant la référence de l'auteur.
 *
 * @param userId Identifiant de l'utilisateur créateur.
 * @returns Objet `{ createdBy }` prêt pour l'insertion Drizzle.
 */
export function createAuditFields(userId: string): { createdBy: string } {
  return { createdBy: userId };
}

/**
 * Prépare le payload d'audit pour une modification d'entité (action UPDATED).
 *
 * @param userId Utilisateur auteur de la modification.
 * @param entityType Type d'entité modifiée (ex: 'ticket').
 * @param entityId Identifiant de l'entité.
 * @param oldValue Données avant modification.
 * @param newValue Données après modification.
 * @returns Le payload structuré `AuditPayload`.
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
 * Prépare le payload d'audit pour une suppression logique d'entité (action DELETED).
 *
 * @param userId Utilisateur effectuant la suppression.
 * @param entityType Type d'entité supprimée.
 * @param entityId Identifiant de l'entité.
 * @returns Le payload structuré `AuditPayload`.
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
