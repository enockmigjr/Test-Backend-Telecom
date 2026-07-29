/**
 * ============================================================================
 * FICHIER : src/common/constants/error-codes.constant.ts
 * RÔLE : Dictionnaire des codes d'erreur unifiés de l'API.
 * EXPLICATION :
 * Lorsqu'un problème survient (mot de passe faux, permission manquante, ticket introuvable),
 * l'API renvoie un code texte unique (ex: "INVALID_CREDENTIALS").
 * Cela permet aux applications frontales (web/mobile) de savoir exactement quel message
 * afficher à l'utilisateur final.
 * ============================================================================
 */

export const ERROR_CODES = {
  // Erreurs de validation (données envoyées mal formées ou manquantes)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',

  // Erreurs d'authentification (problèmes de connexion ou de jeton JWT)
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  TOKEN_REVOKED: 'TOKEN_REVOKED',

  // Erreurs d'autorisation (accès interdit selon le rôle)
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

  // Erreurs de ressources non trouvées
  NOT_FOUND: 'NOT_FOUND',
  TICKET_NOT_FOUND: 'TICKET_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  DEPARTMENT_NOT_FOUND: 'DEPARTMENT_NOT_FOUND',

  // Erreurs de conflit (doublons d'email ou de nom)
  CONFLICT: 'CONFLICT',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  DEPARTMENT_NAME_EXISTS: 'DEPARTMENT_NAME_EXISTS',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',

  // Erreurs de règles métier (ex: changer le statut d'un ticket de manière illégale)
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  TICKET_NOT_RESOLVED: 'TICKET_NOT_RESOLVED',
  TICKET_ALREADY_CLOSED: 'TICKET_ALREADY_CLOSED',
  SLA_BREACH: 'SLA_BREACH',

  // Erreurs techniques internes au serveur
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
} as const;

/**
 * Type TypeScript représentant l'un des codes d'erreur du dictionnaire.
 */
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
