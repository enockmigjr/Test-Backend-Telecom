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
export const redisConfig = {
  /** Nom d'hôte ou adresse IP du serveur Redis. */
  get host(): string {
    return process.env['REDIS_HOST'] || 'localhost';
  },
  /** Port TCP d'écoute du serveur Redis. */
  get port(): number {
    return parseInt(process.env['REDIS_PORT'] || '6379', 10);
  },
  /** Mot de passe d'accès au serveur Redis (si authentification activée). */
  get password(): string | undefined {
    return process.env['REDIS_PASSWORD'] || undefined;
  },
  /** URL de connexion réseau formatée (ex: redis://localhost:6379). */
  get url(): string {
    return process.env['REDIS_URL'] || `redis://${this.host}:${this.port}`;
  },
};
