import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schemas';
import { DatabaseConfigService } from '../config/database.config';
import { AsyncLocalStorage } from 'async_hooks';

export type Database = PostgresJsDatabase<typeof schema>;
interface TransactionContext {
  readonly database: Database;
  readonly afterCommit: Array<() => void | Promise<void>>;
}

/**
 * Fournisseur Drizzle ORM partagé.
 * Initialise la connexion PostgreSQL et exporte l'instance drizzle typée.
 */
@Injectable()
export class DrizzleProvider implements OnModuleInit {
  private readonly logger = new Logger(DrizzleProvider.name);
  private dbInstance!: Database;
  private readonly transactionContext = new AsyncLocalStorage<TransactionContext>();

  constructor(private readonly dbConfig: DatabaseConfigService) {}

  async onModuleInit(): Promise<void> {
    const client = postgres(this.dbConfig.url, {
      max: this.dbConfig.maxConnections,
    });

    this.dbInstance = drizzle(client, { schema });

    this.logger.log('Connexion PostgreSQL établie via Drizzle ORM');
  }

  get db(): Database {
    const context = this.transactionContext.getStore();
    if (context) return context.database;
    if (!this.dbInstance) {
      throw new Error('Drizzle ORM non initialisé. Vérifiez la connexion PostgreSQL.');
    }
    return this.dbInstance;
  }

  async runInTransaction<T>(callback: () => Promise<T>): Promise<T> {
    const afterCommit: Array<() => void | Promise<void>> = [];
    const result = await this.dbInstance.transaction((transaction) =>
      this.transactionContext.run({ database: transaction as Database, afterCommit }, callback),
    );
    for (const effect of afterCommit) {
      try {
        await effect();
      } catch (error: unknown) {
        this.logger.error(`Effet post-commit en échec: ${String(error)}`);
      }
    }
    return result;
  }

  afterCommit(effect: () => void | Promise<void>): void {
    const context = this.transactionContext.getStore();
    if (context) {
      context.afterCommit.push(effect);
      return;
    }
    void effect();
  }
}
