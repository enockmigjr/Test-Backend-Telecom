import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Décorateur pour récupérer l'utilisateur authentifié depuis la requête.
 * Usage : @CurrentUser() user: JwtPayload
 * Usage : @CurrentUser('id') userId: string
 */
export const CurrentUser = createParamDecorator((data: string | undefined, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  const user = request.user;

  if (!user) {
    return null;
  }

  return data ? user[data] : user;
});
