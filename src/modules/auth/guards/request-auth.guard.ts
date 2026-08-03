import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_MODE_KEY, AuthMode } from '../../../common/decorators/auth-mode.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PublicSessionGuard } from '../../external-identity/guards/public-session.guard';
import { IntegrationAssertionGuard } from '../../external-identity/guards/integration-assertion.guard';

/** Orchestre les mécanismes d'auth sans mélanger leurs espaces de jetons. */
@Injectable()
export class RequestAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly internalGuard: JwtAuthGuard,
    private readonly publicGuard: PublicSessionGuard,
    private readonly assertionGuard: IntegrationAssertionGuard,
  ) {}

  canActivate(context: ExecutionContext) {
    const mode = this.reflector.getAllAndOverride<AuthMode>(AUTH_MODE_KEY, [context.getHandler(), context.getClass()]);
    switch (mode ?? AuthMode.INTERNAL) {
      case AuthMode.ANONYMOUS:
        return true;
      case AuthMode.INTERNAL:
        return this.internalGuard.canActivate(context);
      case AuthMode.PUBLIC_SESSION:
        return this.publicGuard.canActivate(context);
      case AuthMode.INTEGRATION_ASSERTION:
        return this.assertionGuard.canActivate(context);
    }
  }
}
