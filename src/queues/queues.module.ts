import { Module, Global, OnModuleInit, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { redisConfig } from '../common/providers/redis.config';

/**
 * Définition des files BullMQ pour le traitement asynchrone.
 *
 * Architecture des files:
 * - email-queue: envoi d'emails (confirmation, notification, alerte)
 * - notification-queue: création de notifications en base + WebSocket emit
 * - sla-queue: vérification et mise à jour des statuts SLA
 * - audit-queue: écriture asynchrone des logs d'audit
 */

export const EMAIL_QUEUE = 'email-queue';
export const NOTIFICATION_QUEUE = 'notification-queue';
export const SLA_QUEUE = 'sla-queue';
export const AUDIT_QUEUE = 'audit-queue';

@Global()
@Module({
  providers: [
    {
      provide: 'BullMQ_Queues',
      useFactory: () => {
        const connection = {
          host: redisConfig.host,
          port: redisConfig.port,
          password: redisConfig.password || undefined,
        };

        return {
          email: new Queue(EMAIL_QUEUE, { connection }),
          notification: new Queue(NOTIFICATION_QUEUE, { connection }),
          sla: new Queue(SLA_QUEUE, { connection }),
          audit: new Queue(AUDIT_QUEUE, { connection }),
        };
      },
    },
  ],
  exports: ['BullMQ_Queues'],
})
export class QueuesModule implements OnModuleInit {
  private readonly logger = new Logger(QueuesModule.name);

  onModuleInit(): void {
    this.logger.log('Files BullMQ initialisées: email, notification, sla, audit');
  }
}
