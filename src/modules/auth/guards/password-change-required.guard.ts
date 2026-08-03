/**
 * ============================================================================
 * FICHIER : src/modules/auth/guards/password-change-required.guard.ts
 * RÔLE : Garde de sécurité (Guard) NestJS pour le contrôle d'accès.
 * EXPLICATION :
 * Ce composant intercepte les requêtes HTTP afin de vérifier les permissions de l'utilisateur avant d'autoriser l'accès.
 * 1. Contrôle l'authentification (ex: jetons JWT validés).
 * 2. Applique les règles de contrôle d'accès basées sur les rôles (RBAC).
 * ============================================================================
 */

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ALLOW_PASSWORD_CHANGE_PENDING_KEY } from '../../../common/decorators/allow-password-change-pending.decorator';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { assertPasswordChangeComplete } from '../password-change-policy';
import { AUTH_MODE_KEY, AuthMode } from '../../../common/decorators/auth-mode.decorator';

@Injectable()
export class PasswordChangeRequiredGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const mode = this.reflector.getAllAndOverride<AuthMode>(AUTH_MODE_KEY, [context.getHandler(), context.getClass()]);
    if (mode && mode !== AuthMode.INTERNAL) return true;
    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_PASSWORD_CHANGE_PENDING_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed) return true;

    const user = context.switchToHttp().getRequest<{ user?: JwtPayload }>().user;
    if (!user) return true;

    assertPasswordChangeComplete(user);
    return true;
  }
}
