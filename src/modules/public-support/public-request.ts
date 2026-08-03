import { BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { PublicPrincipal } from '../external-identity/interfaces/public-principal.interface';

export interface PublicSupportRequest extends Request {
  user?: PublicPrincipal;
}

export function requirePublicPrincipal(request: PublicSupportRequest): PublicPrincipal {
  if (!request.user || request.user.kind !== 'PUBLIC') {
    throw new BadRequestException('Session publique absente.');
  }
  return request.user;
}
