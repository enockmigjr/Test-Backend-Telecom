/**
 * Messages de validation en français.
 * Centralisés pour garantir la cohérence de toutes les erreurs de validation.
 */
export const VALIDATION_MESSAGES = {
  // Messages génériques
  REQUIRED: '{field} est requis.',
  INVALID_TYPE: '{field} doit être de type {type}.',
  MIN_LENGTH: '{field} doit contenir au moins {min} caractères.',
  MAX_LENGTH: '{field} ne peut pas dépasser {max} caractères.',
  MIN_VALUE: '{field} doit être supérieur ou égal à {min}.',
  MAX_VALUE: '{field} doit être inférieur ou égal à {max}.',

  // Email
  EMAIL_INVALID: "L'adresse email fournie n'est pas valide.",
  EMAIL_REQUIRED: "L'adresse email est requise.",

  // Mot de passe
  PASSWORD_REQUIRED: 'Le mot de passe est requis.',
  PASSWORD_MIN_LENGTH: 'Le mot de passe doit contenir au moins 8 caractères.',
  PASSWORD_TOO_WEAK:
    'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial.',
  CURRENT_PASSWORD_INCORRECT: 'Le mot de passe actuel est incorrect.',
  PASSWORDS_DO_NOT_MATCH: 'Les mots de passe ne correspondent pas.',

  // Enum
  ENUM_INVALID: '{field} doit être une des valeurs suivantes : {allowedValues}.',

  // UUID
  UUID_INVALID: "{field} doit être un UUID valide.",

  // Tickets
  TICKET_TITLE_REQUIRED: 'Le titre du ticket est requis.',
  TICKET_TITLE_MIN_LENGTH: 'Le titre du ticket doit contenir au moins 5 caractères.',
  TICKET_DESCRIPTION_REQUIRED: 'La description du ticket est requise.',
  TICKET_STATUS_INVALID: 'Le statut du ticket est invalide.',
  TICKET_TRANSITION_INVALID: 'Transition de statut invalide : {from} → {to}.',
  TICKET_ASSIGNMENT_REQUIRED: "L'assignation du ticket est requise.",

  // Utilisateurs
  USER_FIRST_NAME_REQUIRED: 'Le prénom est requis.',
  USER_LAST_NAME_REQUIRED: 'Le nom de famille est requis.',
  USER_ROLE_REQUIRED: 'Le rôle est requis.',
  USER_DEPARTMENT_REQUIRED: 'Le département est requis.',

  // Fichiers
  FILE_REQUIRED: 'Un fichier est requis.',
  FILE_TOO_LARGE: 'Le fichier est trop volumineux. Taille maximale : {maxSize}.',
  FILE_TYPE_INVALID: 'Type de fichier non autorisé. Types acceptés : {allowedTypes}.',

  // Dates
  DATE_INVALID: '{field} doit être une date ISO 8601 valide.',
  DATE_RANGE_INVALID: 'La date de début doit être antérieure à la date de fin.',
} as const;
