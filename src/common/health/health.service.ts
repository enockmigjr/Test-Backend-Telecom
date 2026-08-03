/**
 * ============================================================================
 * FICHIER : src/common/health/health.service.ts
 * RÔLE : Service de sondes de disponibilité (Health Checks) PostgreSQL et Redis.
 * EXPLICATION :
 * Ce service teste l'état opérationnel des deux dépendances d'infrastructure critiques de l'application :
 * 1. Base de données PostgreSQL : Exécute une requête SQL minimale (`SELECT 1`) via Drizzle.
 * 2. Serveur de cache Redis : Initialise une connexion temporaire avec délai de 3 secondes et envoie la commande `PING`.
 * 3. Restitue un dictionnaire d'état (`ok` ou `error` avec le message de panne) pour l'orchestrateur Docker/Kubernetes.
 * ============================================================================
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { sql } from 'drizzle-orm';
import { Redis } from 'ioredis';
import { redisConfig } from '../providers/redis.config';
import { BullMqQueues } from '../../queues/queues.types';

/**
 * Service réalisant le diagnostic de disponibilité des composants d'infrastructure.
 */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly drizzle: DrizzleProvider,
    @Inject('BullMQ_Queues') private readonly queues: BullMqQueues,
  ) {}

  /**
   * Effectue un contrôle complet et simultané des dépendances PostgreSQL et Redis.
   *
   * @returns Un objet associant le nom de chaque composant à son statut d'opération (`ok` ou `error`).
   */
  async check(): Promise<Record<string, { status: string; message?: string }>> {
    const results: Record<string, { status: string; message?: string }> = {};

    // 1. Sondage de la base de données PostgreSQL via une requête triviale SELECT 1
    try {
      await this.drizzle.db.execute(sql`SELECT 1`);
      results['postgresql'] = { status: 'ok' };
    } catch (error) {
      results['postgresql'] = { status: 'error', message: (error as Error).message };
    }

    // 2. Sondage du serveur de cache et de file d'attente Redis via PING
    try {
      const redis = new Redis({
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password || undefined,
        connectTimeout: 3000,
        maxRetriesPerRequest: 1,
      });
      await redis.ping();
      await redis.quit();
      results['redis'] = { status: 'ok' };
    } catch (error) {
      results['redis'] = { status: 'error', message: (error as Error).message };
    }

    try {
      await this.queues.externalDelivery.getJobCounts('waiting', 'active', 'failed');
      results['externalDeliveryQueue'] = { status: 'ok' };
    } catch (error: unknown) {
      results['externalDeliveryQueue'] = { status: 'error', message: errorCategory(error) };
    }

    return results;
  }
}

function errorCategory(error: unknown): string {
  if (typeof error !== 'object' || error === null) return 'UnknownError';
  const name = 'name' in error && typeof error.name === 'string' ? error.name : 'Error';
  const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined;
  return code ? `${name}:${code}` : name;
}
