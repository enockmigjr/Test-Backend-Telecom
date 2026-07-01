import { Module, MiddlewareConsumer, NestModule, Logger, Inject } from '@nestjs/common';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

/**
 * Module BullBoard — interface de supervision des queues BullMQ.
 *
 * Accessible à : /admin/queues
 * En production, protéger cette route par authentification.
 */
@Module({})
export class BullBoardModule implements NestModule {
  private readonly logger = new Logger(BullBoardModule.name);

  constructor(@Inject('BullMQ_Queues') private readonly queues: Record<string, unknown>) {}

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

    // Monter le routeur Express directement
    const router = serverAdapter.getRouter();
    consumer
      .apply((req: never, res: never, next: () => void) => {
        router(req, res, next);
      })
      .forRoutes('/admin/queues');

    this.logger.log('BullBoard disponible sur /admin/queues');
  }
}
