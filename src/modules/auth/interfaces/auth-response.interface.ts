/**
 * ============================================================================
 * FICHIER : src/modules/auth/interfaces/auth-response.interface.ts
 * RÔLE : Définitions de types, interfaces ou règles de domaine TypeScript.
 * EXPLICATION :
 * Ce fichier définit les structures de données, types stricts ou exceptions métier du domaine.
 * 1. Assure la cohérence des types à travers tout l'applicatif.
 * 2. Facilite l'auto-complétion et la détection d'erreurs à la compilation.
 * ============================================================================
 */

/** Définition de interface `LoginResponse` pour le typage strict. */
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    departmentId: string;
    departmentName: string;
    mustChangePassword: boolean;
  };
}

/** Définition de interface `TokenPair` pour le typage strict. */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
