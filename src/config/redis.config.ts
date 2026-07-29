/**
 * ============================================================================
 * FICHIER : src/config/redis.config.ts
 * RÔLE : Configuration du serveur de mémoire vive Redis.
 * EXPLICATION :
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
  /** Getter `host` : Récupère la valeur de configuration correspondante. */
  get host(): string {
    if (process.env['REDIS_HOST']) {
      return process.env['REDIS_HOST'] === 'localhost' ? '127.0.0.1' : process.env['REDIS_HOST'];
    }
    if (process.env['REDIS_URL']) {
      try {
        const parsed = new URL(process.env['REDIS_URL']);
        if (parsed.hostname) {
          return parsed.hostname === 'localhost' ? '127.0.0.1' : parsed.hostname;
        }
      } catch {}
    }
    return '127.0.0.1';
  }

  /**
   * Port réseau standard de Redis (6379).
   */
  /** Getter `port` : Récupère la valeur de configuration correspondante. */
  get port(): number {
    if (process.env['REDIS_PORT']) {
      return parseInt(process.env['REDIS_PORT'], 10);
    }
    if (process.env['REDIS_URL']) {
      try {
        const parsed = new URL(process.env['REDIS_URL']);
        if (parsed.port) {
          return parseInt(parsed.port, 10);
        }
      } catch {}
    }
    return 6379;
  }

  /**
   * Mot de passe optionnel pour sécuriser l'accès à Redis.
   */
  /** Getter `password` : Récupère la valeur de configuration correspondante. */
  get password(): string | undefined {
    return process.env['REDIS_PASSWORD'] || undefined;
  }

  /**
   * URL de connexion complète à Redis (ex: redis://localhost:6379).
   */
  /** Getter `url` : Récupère la valeur de configuration correspondante. */
  get url(): string {
    return process.env['REDIS_URL'] || `redis://${this.host}:${this.port}`;
  }
}
