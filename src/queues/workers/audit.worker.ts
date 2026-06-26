import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { redisConfig } from '../../common/providers/redis.config';
import { AUDIT_QUEUE } from '../queues.module';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { auditLogs } from '../../database/schemas';
import { generateUuid } from '../../common/helpers/uuidv7.helper';

/**
 * Worker BullMQ pour l'écriture asynchrone des logs d'audit.
 * Écrire les logs d'audit de manière asynchrone évite de bloquer
 * les requêtes HTTP principales.
 */
@Injectable()
export class AuditWorker implements OnModuleInit {
  private readonly logger = new Logger(AuditWorker.name);
  private worker: Worker;

  constructor(private readonly drizzle: DrizzleProvider) {}

  onModuleInit(): void {
    this.worker = new Worker(
      AUDIT_QUEUE,
      async (job: Job) => {
        await this.processAuditLog(job);
      },
      {
        connection: { host: redisConfig.host, port: redisConfig.port, password: redisConfig.password || undefined },
        concurrency: 10,
        removeOnComplete: { count: 1000 },
        removeOnFail: { age: 86400 },
      },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(`Échec écriture audit: job ${job?.id} — ${error.message}`);
    });

    this.logger.log('Audit Worker démarré');
  }

  private async processAuditLog(job: Job): Promise<void> {
    const { userId, action, entityType, entityId, oldValue, newValue, ipAddress, userAgent } = job.data;

    await this.drizzle.db.insert(auditLogs).values({
      id: generateUuid(),
      userId,
      action,
      entityType,
      entityId,
      oldValue: oldValue || null,
      newValue: newValue || null,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    });
  }
}
