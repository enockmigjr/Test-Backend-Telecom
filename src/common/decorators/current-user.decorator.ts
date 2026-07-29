/**
 * ============================================================================
 * FICHIER : src/common/decorators/current-user.decorator.ts
 * RÔLE : Décorateur d'injection de l'utilisateur connecté (`@CurrentUser()`).
 * EXPLICATION :
 * Lorsqu'un utilisateur authentifié envoie une requête HTTP, ses informations
 * (ID, email, rôle, département) sont décodées depuis son jeton JWT.
 * Ce décorateur permet aux contrôleurs de récupérer instantanément l'utilisateur connecté
 * ou l'un de ses champs spécifiques (ex: `@CurrentUser('id')`).
 * ============================================================================
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Décorateur `@CurrentUser()`
 * Injecte l'objet utilisateur connecté (ou une propriété précise) dans les paramètres d'une méthode de contrôleur.
 */
export const CurrentUser = createParamDecorator((data: string | undefined, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  const user = request.user;

  if (!user) {
    return null;
  }

  return data ? user[data] : user;
});
