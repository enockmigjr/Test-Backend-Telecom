import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { redisConfig } from '../../common/providers/redis.config';
import { NOTIFICATION_QUEUE } from '../queues.module';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { notifications } from '../../database/schemas';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { TelecomWebSocketGateway } from '../../websocket/websocket.gateway';

@Injectable()
export class NotificationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationWorker.name);
  private worker: Worker;

  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly wsGateway: TelecomWebSocketGateway,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker(
      NOTIFICATION_QUEUE,
      async (job: Job) => {
        const { userId, type, title, message, referenceType, referenceId } = job.data;

        // 1. Persister en base
        await this.drizzle.db.insert(notifications).values({
          id: generateUuid(),
          userId,
          type,
          title,
          message,
          referenceType: referenceType || null,
          referenceId: referenceId || null,
        });

        // 2. Émettre en temps réel si l'utilisateur est connecté
        if (this.wsGateway.isUserConnected(userId)) {
          this.wsGateway.emitToUser(userId, 'notification.created', {
            type,
            title,
            message,
            referenceType,
            referenceId,
          });
        }
      },
      {
        connection: { host: redisConfig.host, port: redisConfig.port, password: redisConfig.password || undefined },
        concurrency: 10,
        removeOnComplete: { count: 1000 },
        removeOnFail: { age: 86400 },
      },
    );

    this.worker.on('failed', (job, err) => this.logger.error(`Échec notification: ${err.message}`));
    this.logger.log('Notification Worker démarré (concurrency=10)');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
