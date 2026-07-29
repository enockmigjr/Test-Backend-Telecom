/**
 * ============================================================================
 * FICHIER : src/modules/auth/interfaces/jwt-payload.interface.ts
 * RÔLE : Définitions de types, interfaces ou règles de domaine TypeScript.
 * EXPLICATION :
 * Ce fichier définit les structures de données, types stricts ou exceptions métier du domaine.
 * 1. Assure la cohérence des types à travers tout l'applicatif.
 * 2. Facilite l'auto-complétion et la détection d'erreurs à la compilation.
 * ============================================================================
 */

/**
 * Payload du JWT Access Token tel que retourné par JwtStrategy.validate().
 * - `sub` : UUID de l'utilisateur (champ standard JWT, présent dans le token signé)
 * - `id` : alias de `sub`, ajouté par validate() pour la commodité des contrôleurs
 */
export interface JwtPayload {
  sub: string;
  /** Alias de `sub`, peuplé par JwtStrategy.validate(). Préférer `sub` pour le token signé. */
  id?: string;
  email: string;
  role: string;
  departmentId: string;
  mustChangePassword?: boolean;
  jti: string;
  /** Horodatage milliseconde utilisé pour invalider toutes les sessions antérieures. */
  sessionIssuedAt?: number;
}
