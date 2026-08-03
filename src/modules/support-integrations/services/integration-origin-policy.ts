import { BadRequestException } from '@nestjs/common';

export function normalizeExactOrigins(origins: readonly string[]): string[] {
  const normalized = origins.map((origin) => normalizeExactOrigin(origin));
  if (new Set(normalized).size !== normalized.length) throw new BadRequestException('Origines dupliquées.');
  return normalized;
}

function normalizeExactOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new BadRequestException('Origine HTTP invalide.');
  }
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new BadRequestException('Une origine HTTPS exacte est requise.');
  }
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash || value !== url.origin) {
    throw new BadRequestException('Les origines ne doivent contenir ni chemin, ni identifiants, ni paramètres.');
  }
  return url.origin;
}
