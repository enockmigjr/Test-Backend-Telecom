import { BadRequestException, Body, Controller, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiHeader,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { Request } from 'express';
import { Auth, AuthMode } from '../../common/decorators/auth-mode.decorator';
import { PublicSupportApi } from '../../common/openapi/public-support-api.decorator';
import { AllowTrustedDeviceRestore } from './decorators/allow-trusted-device-restore.decorator';
import { ConsumeEmailVerificationDto, RequestEmailVerificationDto } from './dto/contact-verification.dto';
import { ConsumeBootstrapDto } from './dto/public-session.dto';
import {
  BootstrapGrantResponseDto,
  DeviceRevokedResponseDto,
  PublicSessionResponseDto,
  VerificationRejectedResponseDto,
  VerificationRequestResponseDto,
} from './dto/public-identity-response.dto';
import { PublicPrincipal } from './interfaces/public-principal.interface';
import { BootstrapGrantService } from './services/bootstrap-grant.service';
import { ContactVerificationService } from './services/contact-verification.service';
import { PublicSessionService } from './services/public-session.service';
import { TrustedDeviceService } from './services/trusted-device.service';

interface PublicRequest extends Request {
  user?: PublicPrincipal;
}

@ApiTags('Support public - identité')
@ApiExtraModels(PublicSessionResponseDto, VerificationRejectedResponseDto)
@Controller('public-support')
export class ExternalIdentityController {
  constructor(
    private readonly verification: ContactVerificationService,
    private readonly sessions: PublicSessionService,
    private readonly devices: TrustedDeviceService,
    private readonly bootstrap: BootstrapGrantService,
  ) {}

  @Post('identity/email/request')
  @Auth(AuthMode.ANONYMOUS)
  @PublicSupportApi()
  @ApiOperation({ summary: 'Demander un code de vérification email', security: [] })
  @ApiCreatedResponse({ type: VerificationRequestResponseDto })
  requestEmail(@Body() dto: RequestEmailVerificationDto, @Req() request: Request) {
    return this.verification.requestEmail(dto.integrationKey, dto.email, clientIp(request));
  }

  @Post('identity/email/consume')
  @Auth(AuthMode.ANONYMOUS)
  @PublicSupportApi()
  @ApiOperation({ summary: 'Vérifier le code et ouvrir une session publique', security: [] })
  @ApiCreatedResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(PublicSessionResponseDto) },
        { $ref: getSchemaPath(VerificationRejectedResponseDto) },
      ],
    },
  })
  async consumeEmail(@Body() dto: ConsumeEmailVerificationDto, @Req() request: Request) {
    const outcome = await this.verification.consumeEmail(dto.challengeId, dto.code, clientIp(request));
    if (!outcome.verified) return { data: { verified: false } };
    return this.openSession(outcome.requesterId, outcome.integrationId, true);
  }

  @Post('identity/assertion/exchange')
  @Auth(AuthMode.INTEGRATION_ASSERTION)
  @PublicSupportApi()
  @ApiBearerAuth('integrationAssertion')
  @ApiOperation({ summary: 'Échanger une assertion signée contre une session publique' })
  @ApiCreatedResponse({ type: PublicSessionResponseDto })
  exchangeAssertion(@Req() request: PublicRequest) {
    const principal = requirePublicPrincipal(request);
    return this.openSession(principal.externalRequesterId, principal.supportIntegrationId, true);
  }

  @Post('session/bootstrap/request')
  @Auth(AuthMode.PUBLIC_SESSION)
  @PublicSupportApi()
  @ApiBearerAuth('publicSession')
  @ApiOperation({ summary: 'Créer un code de transfert iframe vers pleine page' })
  @ApiCreatedResponse({ type: BootstrapGrantResponseDto })
  async requestBootstrap(@Req() request: PublicRequest) {
    const principal = requirePublicPrincipal(request);
    if (!principal.deviceId) throw new BadRequestException('Aucun appareil associé à cette session.');
    const grant = await this.bootstrap.issue(
      principal.externalRequesterId,
      principal.supportIntegrationId,
      principal.deviceId,
    );
    return { data: { code: grant.code, expiresAt: grant.expiresAt } };
  }

  @Post('session/bootstrap/consume')
  @Auth(AuthMode.ANONYMOUS)
  @PublicSupportApi()
  @ApiOperation({ summary: 'Consommer une fois un code de transfert', security: [] })
  @ApiCreatedResponse({ type: PublicSessionResponseDto })
  async consumeBootstrap(@Body() dto: ConsumeBootstrapDto) {
    const grant = await this.bootstrap.consume(dto.code);
    const device = await this.devices.rotate(
      grant.trustedDeviceId,
      grant.externalRequesterId,
      grant.supportIntegrationId,
    );
    return this.sessionResponse(grant.externalRequesterId, grant.supportIntegrationId, device, true);
  }

  @Post('session/restore')
  @Auth(AuthMode.PUBLIC_SESSION)
  @AllowTrustedDeviceRestore()
  @PublicSupportApi()
  @ApiHeader({ name: 'x-trusted-device', required: true })
  @ApiHeader({ name: 'x-integration-key', required: true })
  @ApiOperation({
    summary: 'Restaurer et faire tourner la confiance de l’appareil',
    security: [{ trustedDevice: [], integrationKey: [] }],
  })
  @ApiCreatedResponse({ type: PublicSessionResponseDto })
  async restore(@Req() request: PublicRequest) {
    const principal = requirePublicPrincipal(request);
    if (!principal.deviceId) throw new BadRequestException('Aucun appareil associé à cette session.');
    const device = await this.devices.rotate(
      principal.deviceId,
      principal.externalRequesterId,
      principal.supportIntegrationId,
    );
    return this.sessionResponse(principal.externalRequesterId, principal.supportIntegrationId, device);
  }

  @Post('session/revoke-device')
  @Auth(AuthMode.PUBLIC_SESSION)
  @PublicSupportApi()
  @ApiBearerAuth('publicSession')
  @ApiOperation({ summary: 'Révoquer l’appareil courant' })
  @ApiCreatedResponse({ type: DeviceRevokedResponseDto })
  async revokeDevice(@Req() request: PublicRequest) {
    const principal = requirePublicPrincipal(request);
    if (principal.deviceId) await this.devices.revoke(principal.deviceId, principal.externalRequesterId);
    return { data: { revoked: true } };
  }

  private async openSession(externalRequesterId: string, supportIntegrationId: string, verified?: boolean) {
    const device = await this.devices.issue(externalRequesterId, supportIntegrationId);
    return this.sessionResponse(externalRequesterId, supportIntegrationId, device, verified);
  }

  private sessionResponse(
    externalRequesterId: string,
    supportIntegrationId: string,
    device: { readonly deviceId: string; readonly token: string; readonly expiresAt: Date },
    verified?: boolean,
  ) {
    return {
      data: {
        ...(verified === undefined ? {} : { verified }),
        accessToken: this.sessions.issue(externalRequesterId, supportIntegrationId, device.deviceId),
        expiresIn: this.sessions.expiresInSeconds,
        trustedDeviceToken: device.token,
        trustedDeviceExpiresAt: device.expiresAt,
      },
    };
  }
}

function clientIp(request: Request): string {
  return request.ip || request.socket.remoteAddress || 'unknown';
}

function requirePublicPrincipal(request: PublicRequest): PublicPrincipal {
  if (!request.user || request.user.kind !== 'PUBLIC') throw new BadRequestException('Session publique absente.');
  return request.user;
}
