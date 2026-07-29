/**
 * ============================================================================
 * FICHIER : src/modules/auth/password-change-policy.ts
 * RÔLE : Politique d'obligation de changement du mot de passe temporaire à la première connexion.
 * EXPLICATION :
 * Lorsqu'un nouvel utilisateur est créé par un administrateur, un mot de passe temporaire lui est attribué
 * et l'attribut `mustChangePassword` est positionné à `true` :
 * 1. Cette fonction inspecte le jeton JWT de l'utilisateur lors de chaque requête sur des ressources protégées.
 * 2. Si `mustChangePassword === true`, l'accès est immédiatement refusé avec l'erreur `PASSWORD_CHANGE_REQUIRED` (403).
 * 3. L'utilisateur est contraint de passer par la route `POST /auth/change-password` pour débloquer son compte.
 * ============================================================================
 */

import { ForbiddenException } from '@nestjs/common';

import { JwtPayload } from './interfaces/jwt-payload.interface';

/**
 * Bloque l'accès aux fonctionnalités du système si l'utilisateur doit obligatoirement changer son mot de passe temporaire.
 *
 * @param user Payload du jeton JWT extrait de la requête HTTP.
 * @throws ForbiddenException (403) avec le code 'PASSWORD_CHANGE_REQUIRED' si le changement est requis.
 */
export function assertPasswordChangeComplete(user: JwtPayload): void {
  if (!user.mustChangePassword) return;

  throw new ForbiddenException({
    code: 'PASSWORD_CHANGE_REQUIRED',
    message: "Vous devez modifier votre mot de passe temporaire avant d'accéder à cette ressource.",
  });
}
