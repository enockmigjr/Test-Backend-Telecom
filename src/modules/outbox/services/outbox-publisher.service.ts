import { Inject, Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { hostname } from 'os';
import { BullMqQueues } from '../../../queues/queues.types';
import { OutboxService } from './outbox.service';

@Injectable()
export class OutboxPublisherService {
  private readonly logger = new Logger(OutboxPublisherService.name);
  private readonly workerId = `${hostname()}:${process.pid}:outbox`;
  private running = false;

  constructor(
    private readonly outbox: OutboxService,
    @Inject('BullMQ_Queues') private readonly queues: BullMqQueues,
  ) {}

  @Interval(1000)
  async publishBatch(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const events = await this.outbox.claim(this.workerId);
      for (const event of events) {
        try {
          await this.queues.externalDelivery.add(
            'dispatch-outbox-event',
            { outboxEventId: event.id },
            { jobId: event.id },
          );
          await this.outbox.published(event.id, this.workerId);
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

function errorCategory(error: unknown): string {
  if (typeof error !== 'object' || error === null) return 'UnknownError';
  const name = 'name' in error && typeof error.name === 'string' ? error.name : 'Error';
  const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined;
  return code ? `${name}:${code}` : name;
}
