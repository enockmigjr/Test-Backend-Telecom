import { Module, NestModule, MiddlewareConsumer, Logger, Inject } from '@nestjs/common';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Request, Response, NextFunction } from 'express';

/**
 * Protection basique par Basic Auth pour BullBoard en production.
 * En développement (NODE_ENV=development), l'accès est libre.
 */
function basicAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const isDev = (process.env['NODE_ENV'] || 'development') === 'development';
  if (isDev) {
    next();
    return;
  }

  const user = process.env['BULLBOARD_USER'] || 'admin';
  const pass = process.env['BULLBOARD_PASSWORD'] || 'bullboard';
  const auth = req.headers.authorization;

  if (!auth || !auth.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="BullBoard"');
    res.status(401).send('Authentification requise');
    return;
  }

  const credentials = Buffer.from(auth.slice(6), 'base64').toString().split(':');
  if (credentials[0] === user && credentials[1] === pass) {
    next();
  } else {
    res.setHeader('WWW-Authenticate', 'Basic realm="BullBoard"');
    res.status(403).send('Accès refusé');
  }
}

/**
 * Module BullBoard — interface de supervision des queues BullMQ.
 *
 * Accessible à : /admin/queues
 * En production (NODE_ENV != development) : protégé par Basic Auth.
 * Configurer BULLBOARD_USER / BULLBOARD_PASSWORD dans le .env.
 */
@Module({})
export class BullBoardModule implements NestModule {
  private readonly logger = new Logger(BullBoardModule.name);

  constructor(
    @Inject('BullMQ_Queues') private readonly queues: Record<string, unknown>,
  ) {}

  configure(consumer: MiddlewareConsumer): void {
    const queueInstances = [
      new BullMQAdapter(this.queues['email'] as never),
      new BullMQAdapter(this.queues['notification'] as never),
      new BullMQAdapter(this.queues['sla'] as never),
      new BullMQAdapter(this.queues['audit'] as never),
      new BullMQAdapter(this.queues['report'] as never),
    ];

    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');

    createBullBoard({ queues: queueInstances, serverAdapter });

    // Monter le routeur Express avec protection Basic Auth
    const router = serverAdapter.getRouter();
    consumer
      .apply(basicAuthMiddleware, (req: unknown, res: unknown, next: () => void) => {
        (router as (req: unknown, res: unknown, next: () => void) => void)(req, res, next);
      })
      .forRoutes('/admin/queues');

    this.logger.log('BullBoard disponible sur /admin/queues' + (process.env['NODE_ENV'] === 'production' ? ' (protégé par Basic Auth)' : ' (dev — accès libre)'));
  }
}
