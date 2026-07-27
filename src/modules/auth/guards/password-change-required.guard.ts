import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ALLOW_PASSWORD_CHANGE_PENDING_KEY } from '../../../common/decorators/allow-password-change-pending.decorator';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { assertPasswordChangeComplete } from '../password-change-policy';

@Injectable()
export class PasswordChangeRequiredGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
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
