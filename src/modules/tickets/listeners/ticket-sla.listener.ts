import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { redisConfig } from '../../../common/providers/redis.config';
import { SLA_QUEUE } from '../../../queues/queues.module';
import { TicketCreatedEvent, TicketResolvedEvent } from '../domain/ticket.events';

@Injectable()
export class TicketSlaListener {
  private readonly logger = new Logger(TicketSlaListener.name);
  private slaQueue: Queue;

  constructor() {
    this.slaQueue = new Queue(SLA_QUEUE, {
      connection: { host: redisConfig.host, port: redisConfig.port, password: redisConfig.password || undefined },
    });
  }

  @OnEvent('ticket.created')
  async handleCreated(event: TicketCreatedEvent): Promise<void> {
    // Planifier une vérification SLA à l'échéance
    await this.slaQueue.add(
      'check_breach',
      { ticketId: event.ticket['id'] as string, action: 'check_breach' },
      { delay: this.calculateDelay(event.ticket['resolutionDueAt'] as string) },
    );
    this.logger.debug(`Vérification SLA planifiée pour ticket ${event.ticket['ticketNumber']}`);
  }

  @OnEvent('ticket.resolved')
  async handleResolved(event: TicketResolvedEvent): Promise<void> {
    // Annuler la vérification SLA pour les tickets résolus
    this.logger.debug(`Ticket ${event.ticketId} résolu — SLA check annulé`);
  }

  private calculateDelay(dueAt: string): number {
    const due = new Date(dueAt).getTime();
    const now = Date.now();
    return Math.max(0, due - now);
  }
}
