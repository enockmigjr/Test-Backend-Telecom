/**
 * ============================================================================
 * FICHIER : src/config/app.config.ts
 * RÔLE : Service de lecture et centralisation des paramètres de l'application.
 * EXPLICATION (Pour non-développeurs) :
 * Ce service lit les variables d'environnement (le fichier `.env`) et fournit
 * des valeurs par défaut sécurisées si une variable est absente.
 * Il permet à tous les autres composants de savoir quel port utiliser, quelles sont
 * les limites d'accès (rate-limiting), ou si le système tourne en mode développement ou production.
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';

/**
 * Class AppConfigService
 * Fournit des propriétés d'accès typées aux paramètres système.
 */
@Injectable()
export class AppConfigService {
  /**
   * Port réseau sur lequel le serveur écoute (ex: 3000).
   */
  get port(): number {
    return parseInt(process.env['PORT'] || '3000', 10);
  }

  /**
   * Préfixe d'URL pour toutes les routes API (ex: "api/v1").
   */
  get apiPrefix(): string {
    return process.env['API_PREFIX'] || 'api/v1';
  }

  /**
   * Indique si l'application s'exécute en environnement de développement local.
   */
  get isDev(): boolean {
    return (process.env['NODE_ENV'] || 'development') === 'development';
  }

  /**
   * Indique si l'application s'exécute en environnement de production.
   */
  get isProd(): boolean {
    return process.env['NODE_ENV'] === 'production';
  }

  /**
   * Niveau de détail des journaux de logs ('debug', 'info', 'warn', 'error').
   */
  get logLevel(): string {
    return process.env['LOG_LEVEL'] || (this.isDev ? 'debug' : 'info');
  }

  /**
   * Liste des domaines autorisés à communiquer avec l'API (CORS).
   */
  get corsOrigin(): string {
    return process.env['CORS_ORIGIN'] || 'http://localhost:5173,http://localhost:3000';
  }

  /**
   * Fenêtre de temps (en millisecondes) pour la limitation générale des requêtes HTTP (ex: 15 min).
   */
  get throttleTtl(): number {
    return parseInt(process.env['THROTTLE_TTL'] || '900000', 10);
  }

  /**
   * Nombre maximum de requêtes HTTP autorisées par fenêtre de temps générale.
   */
  get throttleLimit(): number {
    return parseInt(process.env['THROTTLE_LIMIT'] || '1000', 10);
  }

  /**
   * Fenêtre de temps (en ms) pour la limitation renforcée des tentatives d'authentification (ex: 1 heure).
   */
  get throttleAuthTtl(): number {
    return parseInt(process.env['THROTTLE_AUTH_TTL'] || '3600000', 10);
  }

  /**
   * Nombre maximum d'essais de connexion autorisés par heure (protection anti-brute force).
   */
  get throttleAuthLimit(): number {
    return parseInt(process.env['THROTTLE_AUTH_LIMIT'] || '20', 10);
  }
}
