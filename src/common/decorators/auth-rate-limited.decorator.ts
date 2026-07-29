/**
 * ============================================================================
 * FICHIER : src/common/decorators/auth-rate-limited.decorator.ts
 * RÔLE : Décorateur et helper de détection de limitation de débit sur l'authentification.
 * EXPLICATION :
 * Permet de marquer spécifiquement les endpoints d'authentification (connexion, rafraîchissement)
 * pour leur appliquer des quotas d'appels beaucoup plus stricts afin d'empêcher les attaques
 * par force brute.
 * ============================================================================
 */

import { SetMetadata } from '@nestjs/common';

/** Clé de métadonnées pour marquer une route soumise à la limitation stricte d'auth */
export const AUTH_RATE_LIMITED_KEY = 'auth-rate-limited';

/** Décorateur `@AuthRateLimited()` */
export const AuthRateLimited = () => SetMetadata(AUTH_RATE_LIMITED_KEY, true);

/** Fonction utilitaire vérifiant si une méthode possède ce décorateur */
export function isAuthRateLimited(handler: object): boolean {
  return Reflect.getMetadata(AUTH_RATE_LIMITED_KEY, handler) === true;
}
