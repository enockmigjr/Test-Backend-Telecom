/**
 * ============================================================================
 * FICHIER : src/common/decorators/roles.decorator.ts
 * RÔLE : Décorateur `@Roles()` pour la restriction d'accès basée sur les rôles (RBAC).
 * EXPLICATION :
 * Ce décorateur s'attache à une route d'API pour restreindre son utilisation aux utilisateurs
 * possédant au moins l'un des rôles spécifiés (ex: `@Roles('ADMINISTRATOR', 'SUPERVISOR')`).
 * ============================================================================
 */

import { SetMetadata } from '@nestjs/common';

/** Clé de métadonnées pour le stockage des rôles autorisés */
export const ROLES_KEY = 'roles';

/**
 * Décorateur `@Roles(...)` : spécifie la liste des rôles autorisés à exécuter la méthode d'API.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
