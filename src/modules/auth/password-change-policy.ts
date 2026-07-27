import { ForbiddenException } from '@nestjs/common';

import { JwtPayload } from './interfaces/jwt-payload.interface';

export function assertPasswordChangeComplete(user: JwtPayload): void {
  if (!user.mustChangePassword) return;

  throw new ForbiddenException({
    code: 'PASSWORD_CHANGE_REQUIRED',
    message: "Vous devez modifier votre mot de passe temporaire avant d'acceder a cette ressource.",
  });
}
