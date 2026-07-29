/**
 * ============================================================================
 * FICHIER : src/common/helpers/pagination.helper.ts
 * RÔLE : Outil d'aide au calcul et formatage de la pagination pour l'API.
 * EXPLICATION :
 * Cet utilitaire calcule le nombre total de pages disponibles (`totalPages`),
 * le saut de lignes en base de données (`offset`), et enveloppe la réponse HTTP
 * avec les données et les métadonnées (page 1 sur 10, total 200 éléments).
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';

/**
 * Class PaginationHelper
 */
@Injectable()
export class PaginationHelper {
  /**
   * Calcule les métadonnées de pagination (total, pages totales).
   */
  static buildMeta(page: number, limit: number, total: number) {
    const totalPages = Math.ceil(total / limit);
    return {
      page,
      limit,
      total,
      totalPages,
    };
  }

  /**
   * Calcule l'offset SQL (nombre d'éléments à sauter dans la base de données).
   */
  static getOffset(page: number, limit: number): number {
    return (page - 1) * limit;
  }

  /**
   * Construit et retourne une réponse paginée complète.
   */
  static paginate<T>(data: T[], total: number, page: number, limit: number) {
    return {
      data,
      meta: this.buildMeta(page, limit, total),
    };
  }
}
