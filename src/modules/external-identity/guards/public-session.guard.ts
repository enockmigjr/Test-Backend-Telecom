import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { TRUSTED_DEVICE_RESTORE_KEY } from '../decorators/allow-trusted-device-restore.decorator';
import { PublicPrincipal } from '../interfaces/public-principal.interface';
import { PublicSessionService } from '../services/public-session.service';
import { TrustedDeviceService } from '../services/trusted-device.service';

interface PublicRequest extends Request {
  user?: PublicPrincipal;
}

@Injectable()
export class PublicSessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: PublicSessionService,
    private readonly devices: TrustedDeviceService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PublicRequest>();
    const allowDeviceRestore = this.reflector.getAllAndOverride<boolean>(TRUSTED_DEVICE_RESTORE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowDeviceRestore) return this.authenticateRestore(request);
    const sessionToken = bearerToken(request);
    if (!sessionToken) throw new UnauthorizedException('Session publique requise.');
    request.user = await this.sessions.validate(sessionToken);
    return true;
  }

  private async authenticateRestore(request: PublicRequest): Promise<boolean> {
    const deviceToken = request.header('x-trusted-device');
    const integrationKey = request.header('x-integration-key');
    if (!deviceToken || !integrationKey) throw new UnauthorizedException('Appareil de confiance requis.');
    const device = await this.devices.authenticate(integrationKey, deviceToken);
    request.user = {
      kind: 'PUBLIC',
      sub: device.externalRequesterId,
      externalRequesterId: device.externalRequesterId,
      supportIntegrationId: device.supportIntegrationId,
      deviceId: device.id,
      jti: device.id,
    };
    return true;
  }
}

function bearerToken(request: Request): string | undefined {
  return request.header('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
}
