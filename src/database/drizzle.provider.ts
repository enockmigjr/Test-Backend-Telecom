/**
 * ============================================================================
 * FICHIER : src/database/drizzle.provider.ts
 * RÔLE : Fournisseur de l'ORM Drizzle et gestionnaire de transactions SQL.
 * EXPLICATION :
 * Ce composant crée et gère le pont entre le code NestJS et la base de données PostgreSQL.
 * Il offre également la possibilité d'exécuter des requêtes regroupées dans des "transactions"
 * (si une étape échoue, toute l'opération est annulée pour ne pas corrompre les données).
 * ============================================================================
 */

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schemas';
import { DatabaseConfigService } from '../config/database.config';
import { AsyncLocalStorage } from 'async_hooks';

/**
 * Type TypeScript représentant l'instance typée de la base de données.
 */
export type Database = PostgresJsDatabase<typeof schema>;

/**
 * Interface décrivant le contexte d'une transaction active.
 */
interface TransactionContext {
  readonly database: Database;
  readonly afterCommit: Array<() => void | Promise<void>>;
}

/**
 * Classe DrizzleProvider
 * Gère le cycle de vie du client PostgreSQL et fournit l'accès à l'ORM Drizzle.
 */
@Injectable()
export class DrizzleProvider implements OnModuleInit {
  private readonly logger = new Logger(DrizzleProvider.name);
  private dbInstance!: Database;
  private readonly transactionContext = new AsyncLocalStorage<TransactionContext>();

  constructor(private readonly dbConfig: DatabaseConfigService) {}

  /**
   * Initialise la connexion PostgreSQL lors du démarrage du module NestJS.
   */
  async onModuleInit(): Promise<void> {
    const client = postgres(this.dbConfig.url, {
      max: this.dbConfig.maxConnections,
    });

    this.dbInstance = drizzle(client, { schema });

    this.logger.log('Connexion PostgreSQL établie via Drizzle ORM');
  }

  /**
   * Getter `db` : Renvoie l'instance de transaction courante si une transaction est active,
   * sinon renvoie la connexion globale.
   */
  get db(): Database {
    const context = this.transactionContext.getStore();
    if (context) return context.database;
    if (!this.dbInstance) {
      throw new Error('Drizzle ORM non initialisé. Vérifiez la connexion PostgreSQL.');
    }
    return this.dbInstance;
  }

  /**
   * Exécute un ensemble d'opérations dans une transaction SQL atomique.
   */
  async runInTransaction<T>(callback: () => Promise<T>): Promise<T> {
    if (this.transactionContext.getStore()) return callback();
    const afterCommit: Array<() => void | Promise<void>> = [];
    const result = await this.dbInstance.transaction((transaction) =>
      this.transactionContext.run({ database: transaction as Database, afterCommit }, callback),
    );
    for (const effect of afterCommit) {
      try {
        await effect();
      } catch (error: unknown) {
        this.logger.error(`Effet post-commit en échec: ${errorCategory(error)}`);
      }
    }
    return result;
  }

  /**
   * Enregistre une action à exécuter uniquement après que la transaction a réussi et été validée (commit).
   */
  afterCommit(effect: () => void | Promise<void>): void {
    const context = this.transactionContext.getStore();
    if (context) {
      context.afterCommit.push(effect);
      return;
    }
    void effect();
  }
}

function errorCategory(error: unknown): string {
  if (typeof error !== 'object' || error === null) return 'UnknownError';
  const name = 'name' in error && typeof error.name === 'string' ? error.name : 'Error';
  const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined;
  return code ? `${name}:${code}` : name;
}
