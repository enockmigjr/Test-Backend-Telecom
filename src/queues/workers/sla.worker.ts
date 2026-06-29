import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { redisConfig } from '../../common/providers/redis.config';
import { SLA_QUEUE } from '../queues.module';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { tickets } from '../../database/schemas';
import { eq, and, isNull } from 'drizzle-orm';

@Injectable()
export class SlaWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SlaWorker.name);
  private worker: Worker;

  constructor(private readonly drizzle: DrizzleProvider) {}

  onModuleInit(): void {
    this.worker = new Worker(
      SLA_QUEUE,
      async (job: Job) => {
        const { ticketId, action } = job.data;

        if (action === 'check_breach') {
          const [ticket] = await this.drizzle.db
            .select({ id: tickets.id, resolutionDueAt: tickets.resolutionDueAt, slaBreached: tickets.slaBreached })
            .from(tickets)
            .where(and(eq(tickets.id, ticketId), isNull(tickets.deletedAt)))
            .limit(1);

          if (ticket && !ticket.slaBreached && ticket.resolutionDueAt && new Date() > ticket.resolutionDueAt) {
            await this.drizzle.db.update(tickets).set({ slaBreached: true }).where(eq(tickets.id, ticketId));

            this.logger.warn(`SLA Breach confirmé pour ticket ${ticketId}`);
          }
        }
      },
      {
        connection: { host: redisConfig.host, port: redisConfig.port, password: redisConfig.password || undefined },
        concurrency: 5,
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86400 },
      },
    );

    this.worker.on('failed', (job, err) => this.logger.error(`Échec SLA job: ${err.message}`));
    this.logger.log('SLA Worker démarré (concurrency=5)');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
