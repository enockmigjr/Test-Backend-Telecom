import { Injectable } from '@nestjs/common';

/**
 * Service utilitaire pour construire des réponses paginées standardisées.
 */
@Injectable()
export class PaginationHelper {
  /**
   * Calcule les métadonnées de pagination.
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
   * Calcule l'offset SQL à partir de la page et de la limite.
   */
  static getOffset(page: number, limit: number): number {
    return (page - 1) * limit;
  }

  /**
   * Construit une réponse paginée standard.
   */
  static paginate<T>(data: T[], total: number, page: number, limit: number) {
    return {
      data,
      meta: this.buildMeta(page, limit, total),
    };
  }
}
