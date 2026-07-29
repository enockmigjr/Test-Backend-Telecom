/**
 * ============================================================================
 * FICHIER : src/common/providers/redis.config.ts
 * RÔLE : Configuration de la connexion réseau au serveur Redis.
 * EXPLICATION :
 * Ce module extrait et valide les coordonnées de connexion au serveur Redis :
 * 1. `host` : Nom d'hôte du serveur (ex: 'localhost' ou nom de conteneur Docker).
 * 2. `port` : Port réseau Redis (défaut: 6379).
 * 3. `password` : Mot de passe d'authentification facultatif.
 * 4. `url` : URI d'accès Redis complète (ex: `redis://localhost:6379`).
 * ============================================================================
 */

/**
 * Objet de configuration dynamique lisant les variables d'environnement Redis (`process.env`).
 */
function parseRedisHost(): string {
  if (process.env['REDIS_HOST']) {
    return process.env['REDIS_HOST'] === 'localhost' ? '127.0.0.1' : process.env['REDIS_HOST'];
  }
  if (process.env['REDIS_URL']) {
    try {
      const parsed = new URL(process.env['REDIS_URL']);
      if (parsed.hostname) {
        return parsed.hostname === 'localhost' ? '127.0.0.1' : parsed.hostname;
      }
    } catch {}
  }
  return '127.0.0.1';
}

function parseRedisPort(): number {
  if (process.env['REDIS_PORT']) {
    return parseInt(process.env['REDIS_PORT'], 10);
  }
  if (process.env['REDIS_URL']) {
    try {
      const parsed = new URL(process.env['REDIS_URL']);
      if (parsed.port) {
        return parseInt(parsed.port, 10);
      }
    } catch {}
  }
  return 6379;
}

export const redisConfig = {
  /** Nom d'hôte ou adresse IP du serveur Redis. */
  get host(): string {
    return parseRedisHost();
  },
  /** Port TCP d'écoute du serveur Redis. */
  get port(): number {
    return parseRedisPort();
  },
  /** Mot de passe d'accès au serveur Redis (si authentification activée). */
  get password(): string | undefined {
    return process.env['REDIS_PASSWORD'] || undefined;
  },
  /** URL de connexion réseau formatée (ex: redis://127.0.0.1:6379). */
  get url(): string {
    return process.env['REDIS_URL'] || `redis://${this.host}:${this.port}`;
  },
};
