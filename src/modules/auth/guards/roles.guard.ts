/**
 * ============================================================================
 * FICHIER : src/modules/auth/guards/roles.guard.ts
 * RÔLE : Garde de sécurité pour le contrôle d'accès basé sur les rôles (RBAC - Role-Based Access Control).
 * EXPLICATION :
 * Ce garde vérifie que le rôle de l'utilisateur authentifié (présent dans `request.user`) figure parmi les rôles autorisés :
 * 1. Inspecte le décorateur `@Roles(...)` posé sur le contrôleur ou sur la route.
 * 2. Si aucun rôle n'est spécifié, l'accès est libre pour tout utilisateur authentifié.
 * 3. Si l'utilisateur n'a pas le rôle requis (parmi les 7 rôles du système), lève une exception `ForbiddenException` (403).
 * ============================================================================
 */

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';

/**
 * Garde NestJS validant l'adéquation du rôle de l'utilisateur avec les exigences de la route.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  /**
   * Évalue si l'utilisateur possède l'un des rôles exigés par la route ciblée.
   *
   * @param context Contexte d'exécution de la requête HTTP.
   * @returns `true` si l'accès est autorisé.
   * @throws ForbiddenException (403) Si l'utilisateur n'est pas authentifié ou n'a pas le rôle requis.
   */
  canActivate(context: ExecutionContext): boolean {
    // Extraction des rôles exigés depuis les métadonnées de la route ou du contrôleur
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si aucune restriction de rôle n'est définie sur la route, autoriser l'accès
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Récupération de l'objet utilisateur injecté préalablement dans la requête par JwtStrategy
    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('Authentification requise.');
    }

    // Contrôle d'appartenance du rôle utilisateur à la liste des rôles autorisés
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Permissions insuffisantes pour accéder à cette ressource.');
    }

    return true;
  }
}
