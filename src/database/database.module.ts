/**
 * ============================================================================
 * FICHIER : src/database/database.module.ts
 * RÔLE : Module NestJS global gérant l'accès à la base de données PostgreSQL.
 * EXPLICATION (Pour non-développeurs) :
 * Ce module rend l'accès à la base de données disponible dans TOUTE l'application
 * via le fournisseur DrizzleProvider.
 * ============================================================================
 */

import { Global, Module } from '@nestjs/common';
import { DrizzleProvider } from './drizzle.provider';

/**
 * Module de base de données global (accessible partout sans réimportation).
 */
@Global()
@Module({
  providers: [DrizzleProvider],
  exports: [DrizzleProvider],
})
export class DatabaseModule {}
