import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { Request } from 'express';
import { PublicRateLimitService } from '../external-identity/services/public-rate-limit.service';
import { PublicPrincipal } from '../external-identity/interfaces/public-principal.interface';
import { PublicTicketAccessService } from '../public-support/services/public-ticket-access.service';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { supportIntegrations } from '../../database/schemas';
import { ANTIVIRUS_SCANNER, AntivirusScanner } from './security/antivirus-scanner.interface';

interface UploadRequest extends Request {
  user?: PublicPrincipal;
}

@Injectable()
export class PublicAttachmentUploadGuard implements CanActivate {
  constructor(
    private readonly access: PublicTicketAccessService,
    private readonly drizzle: DrizzleProvider,
    private readonly quotas: PublicRateLimitService,
    @Inject(ANTIVIRUS_SCANNER) private readonly antivirus: AntivirusScanner,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<UploadRequest>();
    const principal = request.user;
    if (!principal || principal.kind !== 'PUBLIC') return false;
    const ticketId = request.params['ticketId'];
    const conversationId = request.params['conversationId'];
    if (ticketId) await this.access.requireTicket(ticketId, principal);
    else if (conversationId) await this.access.requireConversation(conversationId, principal);
    else return false;
    const [integration] = await this.drizzle.db
      .select({ features: supportIntegrations.features, quotaPolicy: supportIntegrations.quotaPolicy })
      .from(supportIntegrations)
      .where(and(eq(supportIntegrations.id, principal.supportIntegrationId), eq(supportIntegrations.status, 'ACTIVE')))
      .limit(1);
    const attachmentsEnabled =
      integration.features['attachments'] === true || integration.features['publicAttachments'] === true;
    if (!integration || !attachmentsEnabled) throw new NotFoundException('Fonction indisponible.');
    if (!(await this.antivirus.health())) throw new ServiceUnavailableException('Analyse antivirus indisponible.');
    await this.quotas.consume(
      'attachment-upload',
      [
        {
          value: `requester:${principal.externalRequesterId}`,
          limit: numberPolicy(integration.quotaPolicy, 'attachmentUploadsPerHour', 20),
        },
        { value: `ip:${request.ip}`, limit: numberPolicy(integration.quotaPolicy, 'attachmentUploadsPerIpHour', 50) },
        {
          value: `integration:${principal.supportIntegrationId}`,
          limit: numberPolicy(integration.quotaPolicy, 'attachmentUploadsPerIntegrationHour', 1000),
        },
      ],
      3600,
    );
    return true;
  }
}

function numberPolicy(policy: Record<string, unknown>, key: string, fallback: number): number {
  const value = policy[key];
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}
