import { Inject, Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { hostname } from 'os';
import { BullMqQueues } from '../../../queues/queues.types';
import { OutboxService } from './outbox.service';
import { PublicRealtimeNotifierService } from '../../../websocket/public-realtime-notifier.service';
import { errorCategory } from '../../../common/utils/helpers';

@Injectable()
export class OutboxPublisherService {
  private readonly logger = new Logger(OutboxPublisherService.name);
  private readonly workerId = `${hostname()}:${process.pid}:outbox`;
  private running = false;

  constructor(
    private readonly outbox: OutboxService,
    @Inject('BullMQ_Queues') private readonly queues: BullMqQueues,
    private readonly realtime: PublicRealtimeNotifierService,
  ) {}

  @Interval(1000)
  async publishBatch(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const events = await this.outbox.claim(this.workerId);
      for (const event of events) {
        try {
          if (event.eventType === 'PUBLIC_ATTACHMENT_QUARANTINED') {
            await this.queues.attachmentScan.add(
              'scan-attachment',
              { attachmentId: event.aggregateId },
              { jobId: event.id },
            );
          } else {
            await this.queues.externalDelivery.add(
              'dispatch-outbox-event',
              { outboxEventId: event.id },
              { jobId: event.id },
            );
          }
          await this.outbox.published(event.id, this.workerId);
          try {
            await this.realtime.notify(event);
          } catch (error: unknown) {
            this.logger.warn(`Temps réel public différé: ${errorCategory(error)}`);
          }
        } catch (error: unknown) {
          await this.outbox.failed(event, this.workerId, error);
          this.logger.warn(`Publication outbox différée: ${event.id} (${errorCategory(error)})`);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
