/**
 * ============================================================================
 * FICHIER : src/websocket/redis-io.adapter.ts
 * RÔLE : Adaptateur Socket.IO Redis Pub/Sub pour le scaling horizontal des WebSockets.
 * EXPLICATION :
 * Cet adaptateur permet de synchroniser les événements temps réel (Socket.IO) entre plusieurs nœuds backend NestJS :
 * 1. Crée deux clients ioredis dédiés (Pub/Sub) connectés à la source canonique `redisConfig`.
 * 2. Utilise `@socket.io/redis-adapter` pour relayer les notifications de tickets et alertes SLA à toutes les instances d'API.
 * 3. Permet à un utilisateur connecté sur le Serveur A de recevoir en temps réel des événements émis par un contrôleur exécuté sur le Serveur B.
 * ============================================================================
 */

import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { redisConfig } from '../common/providers/redis.config';

/**
 * Adapter Socket.io Redis pour le scaling horizontal.
 * Permet à plusieurs instances API de partager les connexions WebSocket.
 *
 * Utilise redisConfig (source canonique) au lieu de lire process.env directement.
 *
 * Usage dans main.ts:
 *   const adapter = new RedisIoAdapter(app);
 *   await adapter.connectToRedis();
 *   app.useWebSocketAdapter(adapter);
 */
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  /**
   * Établit les deux connexions ioredis nécessaires (Publication et Souscription).
   */
  async connectToRedis(): Promise<void> {
    const connection = {
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password || undefined,
      lazyConnect: true,
    };

    const pubClient = new Redis(connection);
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  /**
   * Instancie le serveur Socket.IO et lui attache l'adaptateur Pub/Sub Redis.
   */
  createIOServer(port: number, options?: ServerOptions): unknown {
    const server = super.createIOServer(port, options);

    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }

    return server;
  }
}
