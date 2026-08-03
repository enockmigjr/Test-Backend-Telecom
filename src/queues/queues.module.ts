/**
 * ============================================================================
 * FICHIER : src/queues/queues.module.ts
 * RÔLE : Module NestJS organisant le composant queues.
 * EXPLICATION :
 * Ce module regroupe et configure les contrôleurs, services, répertoires et dépendances de queues.
 * 1. Définit les éléments internes du domaine fonctionnel.
 * 2. Rend les services accessibles aux autres modules ayant importé celui-ci.
 * ============================================================================
 */

import { Module, Global, OnModuleInit, Logger, forwardRef } from '@nestjs/common';
import { Queue } from 'bullmq';
import { redisConfig } from '../common/providers/redis.config';
import { EmailWorker } from './workers/email.worker';
import { NotificationWorker } from './workers/notification.worker';
import { SlaWorker } from './workers/sla.worker';
import { AuditWorker } from './workers/audit.worker';
import { ReportWorker } from './workers/report.worker';
import { AssignmentWorker, ASSIGNMENT_QUEUE } from './workers/assignment.worker';
import { AttachmentScanWorker } from './workers/attachment-scan.worker';

export const EMAIL_QUEUE = 'email-queue';
export const NOTIFICATION_QUEUE = 'notification-queue';
export const SLA_QUEUE = 'sla-queue';
export const AUDIT_QUEUE = 'audit-queue';
export const REPORT_QUEUE = 'report-queue';
export const EXTERNAL_DELIVERY_QUEUE = 'external-delivery-queue';
export const ATTACHMENT_SCAN_QUEUE = 'attachment-scan-queue';
export { ASSIGNMENT_QUEUE };

import { ReportsModule } from '../modules/reports/reports.module';
import { AttachmentsModule } from '../modules/attachments/attachments.module';
import { TicketsModule } from '../modules/tickets/tickets.module';

@Global()
@Module({
  imports: [
    forwardRef(() => ReportsModule),
    AttachmentsModule,
    forwardRef(() => TicketsModule), // Requis pour injecter AssignmentEngineService dans AssignmentWorker
  ],
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
          assignment: new Queue(ASSIGNMENT_QUEUE, { connection }),
          report: new Queue(REPORT_QUEUE, {
            connection,
            defaultJobOptions: {
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 5000,
              },
            },
          }),
          externalDelivery: new Queue(EXTERNAL_DELIVERY_QUEUE, {
            connection,
            defaultJobOptions: {
              attempts: 10,
              backoff: { type: 'fixed', delay: 10_000 },
              removeOnComplete: { age: 7 * 24 * 60 * 60 },
              removeOnFail: { age: 30 * 24 * 60 * 60 },
            },
          }),
          attachmentScan: new Queue(ATTACHMENT_SCAN_QUEUE, {
            connection,
            defaultJobOptions: {
              attempts: 8,
              backoff: { type: 'fixed', delay: 30_000 },
              removeOnComplete: { age: 7 * 24 * 60 * 60 },
              removeOnFail: { age: 30 * 24 * 60 * 60 },
            },
          }),
        };
      },
    },
    EmailWorker,
    NotificationWorker,
    SlaWorker,
    AuditWorker,
    ReportWorker,
    AssignmentWorker,
    AttachmentScanWorker,
  ],
  exports: ['BullMQ_Queues'],
})
/**
 * Module NestJS `QueuesModule` configurant les dépendances, contrôleurs et services associés.
 */
export class QueuesModule implements OnModuleInit {
  private readonly logger = new Logger(QueuesModule.name);

  onModuleInit(): void {
    this.logger.log(
      'Files BullMQ initialisées: email, notification, sla, audit, report, assignment, external-delivery, attachment-scan',
    );
  }
}
