import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { redisConfig } from '../../common/providers/redis.config';
import { AssignmentEngineService } from '../../modules/tickets/services/assignment-engine.service';

export const ASSIGNMENT_QUEUE = 'assignment-queue';

/**
 * Worker BullMQ traitant les jobs de routage automatique des tickets.
 */
@Injectable()
export class AssignmentWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AssignmentWorker.name);
  private worker: Worker;

  constructor(private readonly assignmentEngine: AssignmentEngineService) {}

  onModuleInit(): void {
    const connection = {
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password || undefined,
    };

    this.worker = new Worker(
      ASSIGNMENT_QUEUE,
      async (job: Job) => {
        const { ticketId, action } = job.data;
        this.logger.debug(`Consommation du job d'assignation ${job.id} (Action: ${action}, Ticket: ${ticketId})`);

        if (action === 'route_ticket') {
          const success = await this.assignmentEngine.routeTicket(ticketId);
          if (success) {
            this.logger.log(`Job d'assignation ${job.id} reussi pour le ticket ${ticketId}`);
          } else {
            this.logger.debug(
              `Job d'assignation ${job.id} n'a pas pu assigner le ticket ${ticketId} (aucun agent disponible ou deja traite)`,
            );
          }
        }
      },
      {
        connection,
        concurrency: 10, // Traiter jusqu'à 10 tickets en parallèle
        limiter: {
          max: 100,
          duration: 1000,
        },
      },
    );

    this.worker.on('active', (job) => {
      this.logger.debug(`Job ${job.id} demarre.`);
    });

    this.worker.on('completed', (job) => {
      this.logger.debug(`Job ${job.id} complete avec succes.`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} a echoue avec l'erreur: ${err.message}`, err.stack);
    });

    this.logger.log(`Worker BullMQ Assignment initialise pour la file : ${ASSIGNMENT_QUEUE}`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.logger.log('Worker BullMQ Assignment ferme.');
    }
  }
}
