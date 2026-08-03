/**
 * ============================================================================
 * FICHIER : src/queues/queues.types.ts
 * RÔLE : Définitions de types, interfaces ou règles de domaine TypeScript.
 * EXPLICATION :
 * Ce fichier définit les structures de données, types stricts ou exceptions métier du domaine.
 * 1. Assure la cohérence des types à travers tout l'applicatif.
 * 2. Facilite l'auto-complétion et la détection d'erreurs à la compilation.
 * ============================================================================
 */

import { Queue } from 'bullmq';

/**
 * Type partagé pour l'injection des files BullMQ dans les services et workers.
 * Centralisé ici pour éviter la duplication dans chaque fichier consommateur.
 */
export interface BullMqQueues {
  email: Queue;
  notification: Queue;
  externalDelivery: Queue;
  attachmentScan: Queue;
  [key: string]: Queue;
}
