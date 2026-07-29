/**
 * ============================================================================
 * FICHIER : src/config/redis.config.ts
 * RÔLE : Configuration du serveur de mémoire vive Redis.
 * EXPLICATION (Pour non-développeurs) :
 * Redis est une base de données en mémoire ultra-rapide utilisée pour :
 * 1. Le cache de données (accélérer l'affichage des tableaux de bord).
 * 2. La gestion des files d'attente de tâches (BullMQ - envois d'emails, rapports PDF).
 * 3. La synchronisation des notifications en temps réel (WebSockets).
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';

/**
 * Service RedisConfigService
 * Centralise l'accès aux paramètres de connexion Redis.
 */
@Injectable()
export class RedisConfigService {
  /**
   * Adresse hôte du serveur Redis (ex: localhost ou 127.0.0.1).
   */
  get host(): string {
    return process.env['REDIS_HOST'] || 'localhost';
  }

  /**
   * Port réseau standard de Redis (6379).
   */
  get port(): number {
    return parseInt(process.env['REDIS_PORT'] || '6379', 10);
  }

  /**
   * Mot de passe optionnel pour sécuriser l'accès à Redis.
   */
  get password(): string | undefined {
    return process.env['REDIS_PASSWORD'] || undefined;
  }

  /**
   * URL de connexion complète à Redis (ex: redis://localhost:6379).
   */
  get url(): string {
    return process.env['REDIS_URL'] || `redis://${this.host}:${this.port}`;
  }
}

