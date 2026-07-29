/**
 * ============================================================================
 * FICHIER : src/modules/auth/guards/jwt-auth.guard.ts
 * RÔLE : Garde de sécurité (Guard) vérifiant la validité du jeton JWT sur chaque requête HTTP.
 * EXPLICATION :
 * Ce garde est appliqué globalement sur l'ensemble de l'API :
 * 1. Il inspecte les métadonnées de la route ou du contrôleur pour détecter le décorateur `@Public()`.
 * 2. Si la route est marquée publique (ex: `/auth/login`, `/health`), l'accès est autorisé immédiatement.
 * 3. Sinon, il délègue à la stratégie Passport JWT pour extraire le jeton `Bearer`, vérifier sa signature,
 *    s'assurer qu'il n'est pas dans la liste noire Redis et injecter l'utilisateur dans `request.user`.
 * ============================================================================
 */

import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';

/**
 * Garde NestJS étendant `AuthGuard('jwt')` pour protéger automatiquement les routes non publiques.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  /**
   * Intercepte la requête entrante et détermine si la requête peut se poursuivre.
   *
   * @param context Contexte d'exécution de la requête HTTP.
   * @returns `true` si la route est publique ou si le jeton JWT présenté est valide.
   */
  canActivate(context: ExecutionContext) {
    // Vérification de la présence du décorateur @Public() au niveau de la méthode ou du contrôleur
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si la route est annotée @Public(), ignorer le contrôle du jeton JWT
    if (isPublic) {
      return true;
    }

    // Délégation de la validation du Bearer token à la stratégie Passport JwtStrategy
    return super.canActivate(context);
  }
}
