import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schemas';
import { DatabaseConfigService } from '../config/database.config';

export type Database = PostgresJsDatabase<typeof schema>;

/**
 * Fournisseur Drizzle ORM partagé.
 * Initialise la connexion PostgreSQL et exporte l'instance drizzle typée.
 */
@Injectable()
export class DrizzleProvider implements OnModuleInit {
  private readonly logger = new Logger(DrizzleProvider.name);
  private dbInstance!: Database;

  constructor(private readonly dbConfig: DatabaseConfigService) {}

  async onModuleInit(): Promise<void> {
    const client = postgres(this.dbConfig.url, {
      max: this.dbConfig.maxConnections,
    });

    this.dbInstance = drizzle(client, { schema });

    this.logger.log('Connexion PostgreSQL établie via Drizzle ORM');
  }

  get db(): Database {
    if (!this.dbInstance) {
      throw new Error('Drizzle ORM non initialisé. Vérifiez la connexion PostgreSQL.');
    }
    return this.dbInstance;
  }
}
