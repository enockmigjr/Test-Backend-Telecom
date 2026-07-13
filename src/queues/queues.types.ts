import { Queue } from 'bullmq';

/**
 * Type partagé pour l'injection des files BullMQ dans les services et workers.
 * Centralisé ici pour éviter la duplication dans chaque fichier consommateur.
 */
export interface BullMqQueues {
  email: Queue;
  notification: Queue;
  [key: string]: Queue;
}
