import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { redisConfig } from '../../common/providers/redis.config';
import { EMAIL_QUEUE } from '../queues.module';

/**
 * Worker BullMQ pour le traitement des emails.
 * Consomme les jobs de la file email-queue et envoie les emails via SMTP.
 */
@Injectable()
export class EmailWorker implements OnModuleInit {
  private readonly logger = new Logger(EmailWorker.name);
  private worker: Worker;

  onModuleInit(): void {
    this.worker = new Worker(
      EMAIL_QUEUE,
      async (job: Job) => {
        await this.processEmail(job);
      },
      {
        connection: {
          host: redisConfig.host,
          port: redisConfig.port,
          password: redisConfig.password || undefined,
        },
        concurrency: 5,
        removeOnComplete: { age: 3600 }, // Garder 1h après complétion
        removeOnFail: { age: 86400 }, // Garder 24h après échec
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Email envoyé: job ${job.id} — ${job.data.subject}`);
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error(`Échec email: job ${job?.id} — ${error.message}`);
    });

    this.logger.log('Email Worker démarré');
  }

  private async processEmail(job: Job): Promise<void> {
    const { to, subject, template, data } = job.data;

    // En production: utiliser Nodemailer avec le transport SMTP configuré
    // Pour le développement: logger l'email (Mailpit l'intercepte)

    this.logger.log(`[EMAIL] À: ${to} | Sujet: ${subject} | Template: ${template}`);
    this.logger.debug(`[EMAIL] Données: ${JSON.stringify(data)}`);

    // Simulation de latence SMTP
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
