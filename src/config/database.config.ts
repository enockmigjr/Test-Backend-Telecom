/**
 * ============================================================================
 * FICHIER : src/config/database.config.ts
 * RÔLE : Configuration des accès à la base de données PostgreSQL.
 * EXPLICATION :
 * Ce fichier permet au système de se connecter à la base de données PostgreSQL.
 * Il récupère l'adresse du serveur (host), le port (5432), le nom d'utilisateur,
 * le mot de passe et le nom de la base de données telecom_tickets.
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';

/**
 * Service DatabaseConfigService
 * Centralise et sécurise les paramètres de connexion à PostgreSQL.
 */
@Injectable()
export class DatabaseConfigService {
  /**
   * Adresse hôte du serveur de base de données (ex: localhost ou un serveur dédié).
   */
  /** Getter `host` : Récupère la valeur de configuration correspondante. */
  get host(): string {
    return process.env['DATABASE_HOST'] || 'localhost';
  }

  /**
   * Port réseau standard PostgreSQL (5432).
   */
  /** Getter `port` : Récupère la valeur de configuration correspondante. */
  get port(): number {
    return parseInt(process.env['DATABASE_PORT'] || '5432', 10);
  }

  /**
   * Nom d'utilisateur autorise pour se connecter a la base.
   */
  /** Getter `user` : Récupère la valeur de configuration correspondante. */
  get user(): string {
    return process.env['DATABASE_USER'] || 'telecom';
  }

  /**
   * Mot de passe de connexion a la base de donnees.
   */
  /** Getter `password` : Récupère la valeur de configuration correspondante. */
  get password(): string {
    return process.env['DATABASE_PASSWORD'] || 'telecom_secret';
  }

  /**
   * Nom de la base de donnees contenant toutes les tables (telecom_tickets).
   */
  /** Getter `database` : Récupère la valeur de configuration correspondante. */
  get database(): string {
    return process.env['DATABASE_NAME'] || 'telecom_tickets';
  }

  /**
   * URL de connexion complete (format postgresql://user:pass@host:port/dbname).
   */
  /** Getter `url` : Récupère la valeur de configuration correspondante. */
  get url(): string {
    return (
      process.env['DATABASE_URL'] ||
      `postgresql://${this.user}:${this.password}@${this.host}:${this.port}/${this.database}`
    );
  }

  /**
   * Nombre maximal de connexions simultanees autorisees dans le pool de connexions (ex: 20).
   */
  /** Getter `maxConnections` : Récupère la valeur de configuration correspondante. */
  get maxConnections(): number {
    return parseInt(process.env['DATABASE_MAX_CONNECTIONS'] || '20', 10);
  }
}
