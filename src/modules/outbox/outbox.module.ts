import { Module } from '@nestjs/common';
import { QueuesModule } from '../../queues/queues.module';
import { OutboxPublisherService } from './services/outbox-publisher.service';
import { OutboxService } from './services/outbox.service';

@Module({
  imports: [QueuesModule],
  providers: [OutboxService, OutboxPublisherService],
  exports: [OutboxService],
})
export class OutboxModule {}
