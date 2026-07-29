/**
 * ============================================================================
 * FICHIER : src/queues/workers/email.worker.ts
 * RÔLE : Travailleur asynchrone BullMQ (Worker) pour le dépilage et l'envoi d'emails.
 * EXPLICATION :
 * Ce composant consomme en arrière-plan la file d'attente Redis `email-queue` :
 * 1. Reçoit les tâches d'envoi d'emails (bienvenue, réinitialisation de mot de passe, alertes SLA, notifications de ticket).
 * 2. Reconstruit les pièces jointes encodées en base64 sous forme de `Buffer` pour Nodemailer.
 * 3. Tente l'envoi du courriel via les templates Handlebars du système de fichiers (`.hbs`), avec repli (fallback) sur les templates inline en cas d'absence du fichier.
 * 4. Gère la concurrence (5 travaux en parallèle) et la rétention des journaux de travaux terminés/échoués.
 * ============================================================================
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { redisConfig } from '../../common/providers/redis.config';
import { EMAIL_QUEUE } from '../queues.module';
import { EmailService } from '../../modules/email/email.service';

/**
 * Worker BullMQ dédié au traitement résilient des courriels électroniques.
 */
@Injectable()
export class EmailWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailWorker.name);
  private worker: Worker;

  constructor(private readonly emailService: EmailService) {}

  /**
   * Initialise et démarre l'écouteur du Worker BullMQ au lancement du module.
   */
  onModuleInit(): void {
    this.worker = new Worker(
      EMAIL_QUEUE,
      async (job: Job) => {
        const { to, subject, template, data, attachments } = job.data;

        // Reconstitution des pièces jointes encodées en base64 sous forme de sous-tableaux de Buffers binaires
        const mailAttachments = attachments?.map((att: { filename: string; content: string }) => ({
          filename: att.filename,
          content: Buffer.from(att.content, 'base64'),
        }));

        // Essayer d'abord le rendu avec le fichier template Handlebars (.hbs)
        try {
          await this.emailService.sendTemplate(to, subject, template, data, mailAttachments);
        } catch (err) {
          this.logger.warn(`Échec de l'envoi via template .hbs, passage au fallback inline: ${(err as Error).message}`);
          // Repli sur le générateur HTML d'urgence inline si le fichier template est introuvable
          const html =
            this.emailService.templates[template as keyof typeof this.emailService.templates]?.(data) ||
            `<p>Template "${template}" non trouvé. Données: ${JSON.stringify(data)}</p>`;
          await this.emailService.send(to, subject, html, mailAttachments);
        }
      },
      {
        connection: { host: redisConfig.host, port: redisConfig.port, password: redisConfig.password || undefined },
        concurrency: 5, // 5 envois d'emails traités en parallèle
        removeOnComplete: { age: 3600 }, // Rétention des jobs réussis pendant 1h
        removeOnFail: { age: 86400 }, // Rétention des pannes pendant 24h pour analyse
      },
    );

    // Écouteurs d'événements BullMQ pour la journalisation du cycle de vie du travail
    this.worker.on('completed', (job) => this.logger.log(`Email envoyé: job ${job.id} — ${job.data.subject}`));
    this.worker.on('failed', (job, error) => this.logger.error(`Échec email: job ${job?.id} — ${error.message}`));
    this.logger.log('Email Worker démarré (concurrency=5, retry=3)');
  }

  /**
   * Clôture proprement la connexion du worker BullMQ lors de l'arrêt de l'application.
   */
  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
