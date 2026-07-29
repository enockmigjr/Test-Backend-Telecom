/**
 * ============================================================================
 * FICHIER : src/modules/auth/domain/auth-session.events.ts
 * RÔLE : Définitions de types, interfaces ou règles de domaine TypeScript.
 * EXPLICATION :
 * Ce fichier définit les structures de données, types stricts ou exceptions métier du domaine.
 * 1. Assure la cohérence des types à travers tout l'applicatif.
 * 2. Facilite l'auto-complétion et la détection d'erreurs à la compilation.
 * ============================================================================
 */

export class AuthSessionRevokedEvent {
  constructor(
    public readonly userId: string,
    public readonly jti: string,
  ) {}
}

export class AuthUserSessionsRevokedEvent {
  constructor(public readonly userId: string) {}
}
