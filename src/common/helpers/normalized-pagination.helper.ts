/**
 * ============================================================================
 * FICHIER : src/common/helpers/normalized-pagination.helper.ts
 * RÔLE : Normaliseur sécurisé des paramètres de pagination HTTP (page et limit).
 * EXPLICATION :
 * Ce module assainit et borne les paramètres de pagination reçus dans les requêtes de recherche :
 * 1. Convertit les entrées (string ou undefined) en entiers strictement positifs.
 * 2. Force la page minimale à 1 (`Math.max(1, ...)`).
 * 3. Borne la quantité de résultats par page entre 1 et 100 maximum pour prémunir le serveur contre la saturation mémoire.
 * ============================================================================
 */

/**
 * Interface représentant l'objet de pagination assaini et typé.
 */
export interface NormalizedPagination {
  /** Numéro de la page demandée (≥ 1). */
  page: number;
  /** Nombre d'éléments par page (1 à 100). */
  limit: number;
}

/**
 * Normalise et valide les valeurs de page et de limite de résultats.
 *
 * @param page Valeur brute du paramètre de page.
 * @param limit Valeur brute du paramètre de limite par page.
 * @returns L'objet `NormalizedPagination` assaini.
 */
export function normalizePagination(
  page: number | string | undefined = 1,
  limit: number | string | undefined = 20,
): NormalizedPagination {
  const parsedPage = Number(page);
  const parsedLimit = Number(limit);
  const normalizedPage = Number.isFinite(parsedPage) ? Math.max(1, Math.trunc(parsedPage)) : 1;
  const normalizedLimit = Number.isFinite(parsedLimit) ? Math.min(100, Math.max(1, Math.trunc(parsedLimit))) : 20;
  return { page: normalizedPage, limit: normalizedLimit };
}
