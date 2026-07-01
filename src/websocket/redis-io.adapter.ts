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

  createIOServer(port: number, options?: ServerOptions): unknown {
    const server = super.createIOServer(port, options);

    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }

    return server;
  }
}
