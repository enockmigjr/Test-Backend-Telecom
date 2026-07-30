/**
 * ============================================================================
 * FICHIER : src/queues/workers/audit.worker.ts
 * RÔLE : Travailleur asynchrone BullMQ (Queue Worker).
 * EXPLICATION :
 * Ce composant dépile et exécute en arrière-plan les tâches différées de la file d'attente.
 * 1. Traite les travaux d'arrière-plan de manière résiliente.
 * 2. Gère les réessais en cas de panne temporaire d'un service externe.
 * ============================================================================
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { redisConfig } from '../../common/providers/redis.config';
import { AUDIT_QUEUE } from '../queues.module';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { auditLogs } from '../../database/schemas';
import { generateUuid } from '../../common/helpers/uuidv7.helper';

interface AuditJobData {
  readonly userId: string | null;
  readonly actorType: 'INTERNAL' | 'EXTERNAL_REQUESTER' | 'SYSTEM';
  readonly externalRequesterId: string | null;
  readonly supportIntegrationId: string | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly oldValue?: unknown;
  readonly newValue?: unknown;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

/**
 * Worker BullMQ pour l'écriture asynchrone des logs d'audit.
 * Écrire les logs d'audit de manière asynchrone évite de bloquer
 * les requêtes HTTP principales.
 */
@Injectable()
export class AuditWorker implements OnModuleInit {
  private readonly logger = new Logger(AuditWorker.name);
  private worker: Worker<AuditJobData>;

  constructor(private readonly drizzle: DrizzleProvider) {}

  onModuleInit(): void {
    this.worker = new Worker<AuditJobData>(
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

  private async processAuditLog(job: Job<AuditJobData>): Promise<void> {
    const {
      userId,
      actorType,
      externalRequesterId,
      supportIntegrationId,
      action,
      entityType,
      entityId,
      oldValue,
      newValue,
      ipAddress,
      userAgent,
    } = job.data;

    await this.drizzle.db.insert(auditLogs).values({
      id: generateUuid(),
      userId,
      actorType,
      externalRequesterId,
      supportIntegrationId,
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
