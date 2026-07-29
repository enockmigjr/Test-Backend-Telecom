/**
 * ============================================================================
 * FICHIER : src/common/dto/pagination.dto.ts
 * RÔLE : DTO de pagination réutilisable par toutes les requêtes de recherche/liste.
 * EXPLICATION :
 * Lorsqu'un utilisateur consulte une liste de tickets ou d'utilisateurs, le serveur ne renvoie
 * pas des milliers de lignes en même temps.
 * Ce DTO valide les paramètres `page` (ex: page 1), `limit` (ex: 20 résultats max par page),
 * `sort` (tri par date, statut, etc.) et `order` (ordre croissant ou décroissant).
 * ============================================================================
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO universel de pagination et de tri réutilisable sur toutes les requêtes GET paginées.
 */
export class PaginationDto {
  /** Numéro de page demandée (commence à 1, valeur par défaut: 1). */
  @ApiPropertyOptional({ description: 'Numéro de la page (commence à 1)', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  /** Nombre d'éléments affichés par page (valeur par défaut: 20, maximum: 100). */
  @ApiPropertyOptional({ description: "Nombre d'éléments par page", default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  /** Nom de la colonne SQL utilisée pour le tri des résultats (ex: "createdAt"). */
  @ApiPropertyOptional({ description: 'Champ de tri', default: 'createdAt' })
  @IsOptional()
  sort?: string = 'createdAt';

  /** Sens du tri SQL (asc: croissant, desc: décroissant). */
  @ApiPropertyOptional({ description: 'Ordre de tri', default: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  order?: 'asc' | 'desc' = 'desc';
}
