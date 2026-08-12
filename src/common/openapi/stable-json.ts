import { isRecord } from '../utils/helpers';

/**
 * ============================================================================
 * FICHIER : src/common/openapi/stable-json.ts
 * RÔLE : Sérialiseur JSON déterministe pour la spécification OpenAPI / Swagger.
 * EXPLICATION :
 * Ce fichier fournit des fonctions de tri récursif des clés d'un objet JSON :
 * 1. Trie alphabétiquement les clés des objets complexes de manière récursive (`sortJson`).
 * 2. Produit une chaîne JSON uniforme (`stableJson`) garantissant que deux générations successives
 *    du schéma OpenAPI produisent exactement le même contenu textuel, évitant ainsi des diffs Git inutiles en CI/CD.
 * ============================================================================
 */

/**
 * Prédicat TypeScript vérifiant si la valeur transmise est un objet dictionnaire (non null, non tableau).
 */
/**
 * Fonction récursive triant alphabétiquement les clés de tous les objets contenus dans la structure.
 *
 * @param value Structure de données (objet, tableau ou primitive) à trier.
 * @returns La structure de données équivalente avec clés triées.
 */
function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortJson(child)]),
  );
}

/**
 * Sérialise une structure de données en chaîne JSON déterministe terminée par un saut de ligne.
 *
 * @param value Données à sérialiser.
 * @returns Chaîne JSON formatée et triée.
 */
export function stableJson(value: unknown): string {
  return `${JSON.stringify(sortJson(value), null, 2)}\n`;
}
