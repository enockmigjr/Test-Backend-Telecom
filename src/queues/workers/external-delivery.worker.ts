import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { hostname } from 'os';
import { redisConfig } from '../../common/providers/redis.config';
import { ExternalDeliveryService } from '../../modules/external-delivery/services/external-delivery.service';
import { EXTERNAL_DELIVERY_QUEUE } from '../queues.module';
import { errorCategory } from '../../common/utils/helpers';

interface ExternalDeliveryJob {
  readonly outboxEventId: string;
}

@Injectable()
export class ExternalDeliveryWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExternalDeliveryWorker.name);
  private worker?: Worker<ExternalDeliveryJob>;

  constructor(private readonly deliveries: ExternalDeliveryService) {}

  onModuleInit(): void {
    const workerId = `${hostname()}:${process.pid}:external-delivery`;
    this.worker = new Worker<ExternalDeliveryJob>(
      EXTERNAL_DELIVERY_QUEUE,
      async (job: Job<ExternalDeliveryJob>) => {
        await this.deliveries.dispatch(job.data.outboxEventId, `${workerId}:${job.id ?? 'job'}`);
      },
      {
        connection: {
          host: redisConfig.host,
          port: redisConfig.port,
          password: redisConfig.password || undefined,
        },
        concurrency: 5,
      },
    );
    this.worker.on('failed', (job, error) => {
      this.logger.error(`Livraison externe en échec: ${job?.id ?? 'inconnue'} (${errorCategory(error)})`);
    });
    this.logger.log('External Delivery Worker démarré (concurrency=5)');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
