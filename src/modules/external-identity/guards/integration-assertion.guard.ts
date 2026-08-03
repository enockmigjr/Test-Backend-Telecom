import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { PublicPrincipal } from '../interfaces/public-principal.interface';
import { IntegrationAssertionService } from '../services/integration-assertion.service';

interface AssertionRequest extends Request {
  user?: PublicPrincipal;
}

@Injectable()
export class IntegrationAssertionGuard implements CanActivate {
  constructor(private readonly assertions: IntegrationAssertionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AssertionRequest>();
    const assertion = request.header('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
    if (typeof assertion !== 'string' || assertion.length < 40 || assertion.length > 4096) {
      throw new UnauthorizedException('Assertion requise.');
    }
    request.user = await this.assertions.exchange(assertion);
    return true;
  }
}
