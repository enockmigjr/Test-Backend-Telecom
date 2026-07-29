/**
 * ============================================================================
 * FICHIER : src/config/app.config.ts
 * RÔLE : Service de lecture typé des variables d'environnement globales de l'application.
 * EXPLICATION :
 * Ce service encapsule l'accès aux variables d'environnement du système (`process.env`) :
 * 1. Port d'écoute du serveur HTTP (défaut: 3000).
 * 2. Préfixe d'URL global de l'API REST (défaut: "api/v1").
 * 3. Environnement d'exécution (développement local vs production).
 * 4. Niveau de journalisation structurée Pino ('debug' en dev, 'info' en prod).
 * 5. Origines autorisées CORS pour la sécurité du frontend.
 * 6. Paramètres de limitation de débit HTTP (Rate Limiting / Throttling) pour la protection anti-DDoS et anti-brute force.
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';

/**
 * Service injectable fournissant des accesseurs (getters) fortement typés aux paramètres de l'application.
 */
@Injectable()
export class AppConfigService {
  /**
   * Port réseau TCP sur lequel le serveur backend écoute les requêtes HTTP (ex: 3000).
   */
  get port(): number {
    return parseInt(process.env['PORT'] || '3000', 10);
  }

  /**
   * Préfixe d'URL global appliqué à l'ensemble des routes REST de l'API (ex: "api/v1").
   */
  get apiPrefix(): string {
    return process.env['API_PREFIX'] || 'api/v1';
  }

  /**
   * Indique si l'application s'exécute en mode développement local (`NODE_ENV === 'development'`).
   */
  get isDev(): boolean {
    return (process.env['NODE_ENV'] || 'development') === 'development';
  }

  /**
   * Indique si l'application s'exécute en environnement de production (`NODE_ENV === 'production'`).
   */
  get isProd(): boolean {
    return process.env['NODE_ENV'] === 'production';
  }

  /**
   * Niveau de verbosité du logger Pino ('debug', 'info', 'warn', 'error').
   */
  get logLevel(): string {
    return process.env['LOG_LEVEL'] || (this.isDev ? 'debug' : 'info');
  }

  /**
   * Origines HTTP autorisées par la politique CORS (Cross-Origin Resource Sharing).
   */
  get corsOrigin(): string {
    return process.env['CORS_ORIGIN'] || 'http://localhost:5173,http://localhost:3000';
  }

  /**
   * Fenêtre glissante (en millisecondes) pour le rate-limiting global (défaut: 15 minutes = 900 000 ms).
   */
  get throttleTtl(): number {
    return parseInt(process.env['THROTTLE_TTL'] || '900000', 10);
  }

  /**
   * Quota maximum de requêtes autorisées par IP durant la fenêtre `throttleTtl` (défaut: 1000 requêtes).
   */
  get throttleLimit(): number {
    return parseInt(process.env['THROTTLE_LIMIT'] || '1000', 10);
  }

  /**
   * Fenêtre glissante (en ms) pour la protection renforcée des routes sensibles d'authentification (défaut: 1 heure = 3 600 000 ms).
   */
  get throttleAuthTtl(): number {
    return parseInt(process.env['THROTTLE_AUTH_TTL'] || '3600000', 10);
  }

  /**
   * Nombre maximal de tentatives de connexion échouées par IP durant `throttleAuthTtl` (défaut: 20 essais anti-brute force).
   */
  get throttleAuthLimit(): number {
    return parseInt(process.env['THROTTLE_AUTH_LIMIT'] || '20', 10);
  }
}
