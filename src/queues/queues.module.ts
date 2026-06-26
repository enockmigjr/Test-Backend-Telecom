import { Global, Module } from '@nestjs/common';

/**
 * Module BullMQ pour le traitement asynchrone.
 * Stub — sera étendu avec de vraies queues Redis.
 */
@Global()
@Module({
  providers: [],
  exports: [],
})
export class QueuesModule {}
