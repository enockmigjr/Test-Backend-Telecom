/**
 * ============================================================================
 * FICHIER : src/common/common.module.ts
 * RÔLE : Module utilitaire partagé dans toute l'application.
 * EXPLICATION :
 * Ce module regroupe des outils transversaux utilisés un peu partout :
 * - PaginationHelper : utilitaire de pagination des résultats de listes.
 * - RedisProvider : fournisseur de connexion à la base mémoire Redis.
 * ============================================================================
 */

import { Global, Module } from '@nestjs/common';
import { PaginationHelper } from './helpers/pagination.helper';
import { RedisProvider } from './providers/redis.provider';

/**
 * Module utilitaire global (accessible partout sans avoir besoin d'être réimporté).
 */
@Global()
@Module({
  providers: [PaginationHelper, RedisProvider],
  exports: [PaginationHelper, RedisProvider],
})
/**
 * Module NestJS `CommonModule` configurant les dépendances, contrôleurs et services associés.
 */
export class CommonModule {}
