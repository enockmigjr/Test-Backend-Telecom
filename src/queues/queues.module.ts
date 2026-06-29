import { Module, Global, OnModuleInit, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { redisConfig } from '../common/providers/redis.config';
import { EmailWorker } from './workers/email.worker';
import { NotificationWorker } from './workers/notification.worker';
import { SlaWorker } from './workers/sla.worker';
import { AuditWorker } from './workers/audit.worker';
import { ReportWorker } from './workers/report.worker';

export const EMAIL_QUEUE = 'email-queue';
export const NOTIFICATION_QUEUE = 'notification-queue';
export const SLA_QUEUE = 'sla-queue';
export const AUDIT_QUEUE = 'audit-queue';
export const REPORT_QUEUE = 'report-queue';

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
          report: new Queue(REPORT_QUEUE, { connection }),
        };
      },
    },
    EmailWorker,
    NotificationWorker,
    SlaWorker,
    AuditWorker,
    ReportWorker,
  ],
  exports: ['BullMQ_Queues'],
})
export class QueuesModule implements OnModuleInit {
  private readonly logger = new Logger(QueuesModule.name);

  onModuleInit(): void {
    this.logger.log('Files BullMQ + 5 Workers initialisés: email, notification, sla, audit, report');
  }
}
