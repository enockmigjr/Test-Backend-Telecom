/**
 * Helpers utilitaires partagés.
 *
 * Ces fonctions étaient recopiées à l'identique dans une vingtaine de fichiers
 * (workers, services, openapi, domaine). Elles sont centralisées ici pour que
 * toute correction (ex. catégorisation d'erreur, bornage numérique) n'existe qu'une fois.
 */

/** Catégorise une erreur pour les logs, sans exposer la stack trace. */
export function errorCategory(error: unknown): string {
  if (typeof error !== 'object' || error === null) return 'UnknownError';
  const name = 'name' in error && typeof error.name === 'string' ? error.name : 'Error';
  const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined;
  return code ? `${name}:${code}` : name;
}

/** Prédicat TypeScript : objet dictionnaire (non null, non tableau). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Extrait une valeur numérique strictement positive d'une politique JSON (Record, null ou undefined). */
export function policyNumber(
  policy: Record<string, unknown> | null | undefined,
  key: string,
  fallback: number,
): number {
  const value = policy?.[key];
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

/** Convertit une valeur inconnue en entier strictement positif, sinon fallback. */
export function positiveNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

/** Filtre un tableau inconnu en ne conservant que les chaînes de caractères. */
export function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/** Décompose `version:encrypted` en `[version, encrypted]` avec validation. */
export function splitEncrypted(value: string): readonly [number, string] {
  const separator = value.indexOf(':');
  const version = Number(value.slice(0, separator));
  const encrypted = value.slice(separator + 1);
  if (!Number.isSafeInteger(version) || version < 1 || !encrypted) throw new Error('CIPHERTEXT_INVALID');
  return [version, encrypted];
}
