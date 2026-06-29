import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { redisConfig } from '../../common/providers/redis.config';
import { EMAIL_QUEUE } from '../queues.module';
import { EmailService } from '../../modules/email/email.service';

/**
 * Worker BullMQ pour le traitement des emails.
 * Consomme les jobs de la file email-queue et envoie les emails via SMTP.
 */
@Injectable()
export class EmailWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailWorker.name);
  private worker: Worker;

  constructor(private readonly emailService: EmailService) {}

  onModuleInit(): void {
    this.worker = new Worker(
      EMAIL_QUEUE,
      async (job: Job) => {
        const { to, subject, template, data } = job.data;
        const html =
          this.emailService.templates[template as keyof typeof this.emailService.templates]?.(data) ||
          `<p>${JSON.stringify(data)}</p>`;
        await this.emailService.send(to, subject, html);
      },
      {
        connection: { host: redisConfig.host, port: redisConfig.port, password: redisConfig.password || undefined },
        concurrency: 5,
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86400 },
      },
    );

    this.worker.on('completed', (job) => this.logger.log(`Email envoyé: job ${job.id} — ${job.data.subject}`));
    this.worker.on('failed', (job, error) => this.logger.error(`Échec email: job ${job?.id} — ${error.message}`));
    this.logger.log('Email Worker démarré (concurrency=5, retry=3)');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
