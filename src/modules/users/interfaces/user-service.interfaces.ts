/**
 * ============================================================================
 * FICHIER : src/modules/users/interfaces/user-service.interfaces.ts
 * RÔLE : Définitions de types, interfaces ou règles de domaine TypeScript.
 * EXPLICATION :
 * Ce fichier définit les structures de données, types stricts ou exceptions métier du domaine.
 * 1. Assure la cohérence des types à travers tout l'applicatif.
 * 2. Facilite l'auto-complétion et la détection d'erreurs à la compilation.
 * ============================================================================
 */

/**
 * Interfaces nommées pour les méthodes de UsersService.
 * Remplacent les DTOs inline anonymes dans les signatures de service.
 */

export interface CreateUserInput {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  departmentId: string;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  role?: string;
  departmentId?: string;
  isAvailable?: boolean;
  absenceEndsAt?: Date | string | null;
}
