import { Injectable } from '@nestjs/common';
import { EmailService } from '../../email/email.service';
import { ChannelAdapter, ChannelDeliveryInput, ChannelDeliveryResult } from '../interfaces/channel-adapter.interface';

@Injectable()
export class EmailChannelAdapter implements ChannelAdapter {
  constructor(private readonly email: EmailService) {}

  async deliver(input: ChannelDeliveryInput): Promise<ChannelDeliveryResult> {
    const providerMessageId = await this.email.sendTemplate(
      input.destination,
      subjectFor(input.eventType, input.ticketNumber),
      'publicSupportEvent',
      {
        eventLabel: labelFor(input.eventType),
        ticketNumber: input.ticketNumber,
        ...(input.satisfactionUrl ? { satisfactionUrl: input.satisfactionUrl } : {}),
      },
      undefined,
      { messageId: `<public-support-${input.deliveryId}@telecom.local>` },
    );
    return providerMessageId ? { providerMessageId } : {};
  }
}

function subjectFor(eventType: string, ticketNumber?: string): string {
  const suffix = ticketNumber ? ` — ${ticketNumber}` : '';
  return `${labelFor(eventType)}${suffix}`;
}

function labelFor(eventType: string): string {
  const labels: Record<string, string> = {
    PUBLIC_TICKET_CREATED: 'Demande reçue',
    PUBLIC_REPLY_CREATED: 'Nouvelle réponse du support',
    PUBLIC_REPLY_CORRECTED: 'Correction du support',
    PUBLIC_INFORMATION_REQUESTED: 'Information demandée',
    PUBLIC_STATUS_CHANGED: 'Mise à jour de votre demande',
    PUBLIC_TICKET_RESOLVED: 'Demande résolue',
    PUBLIC_TICKET_CLOSED: 'Demande clôturée',
    PUBLIC_TICKET_REOPENED: 'Demande rouverte',
    PUBLIC_HUMAN_HANDOFF_REQUESTED: 'Transfert vers un conseiller demandé',
    SATISFACTION_REQUEST: 'Votre avis compte',
  };
  return labels[eventType] ?? 'Mise à jour de votre demande';
}
