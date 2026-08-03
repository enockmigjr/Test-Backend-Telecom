import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DrizzleProvider } from '../database/drizzle.provider';
import { OutboxEvent, tickets } from '../database/schemas';
import { PublicSupportGateway } from './public-support.gateway';

@Injectable()
export class PublicRealtimeNotifierService {
  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly gateway: PublicSupportGateway,
  ) {}

  async notify(event: OutboxEvent): Promise<void> {
    if (!event.supportIntegrationId || !event.eventType.startsWith('PUBLIC_')) return;
    let requesterId = event.externalRequesterId;
    if (!requesterId && event.aggregateType === 'TICKET') {
      const [ticket] = await this.drizzle.db
        .select({ requesterId: tickets.requesterId })
        .from(tickets)
        .where(eq(tickets.id, event.aggregateId))
        .limit(1);
      requesterId = ticket?.requesterId ?? null;
    }
    if (!requesterId) return;
    this.gateway.emitRefresh(event.supportIntegrationId, requesterId, resource(event.aggregateType), event.aggregateId);
  }
}

function resource(aggregateType: string): 'ticket' | 'conversation' | 'attachment' {
  if (aggregateType === 'ATTACHMENT') return 'attachment';
  if (aggregateType === 'SUPPORT_CONVERSATION') return 'conversation';
  return 'ticket';
}
