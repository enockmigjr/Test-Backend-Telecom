import { Module } from '@nestjs/common';
import { QueuesModule } from '../../queues/queues.module';
import { OutboxPublisherService } from './services/outbox-publisher.service';
import { OutboxService } from './services/outbox.service';
import { WebSocketModule } from '../../websocket/websocket.module';

@Module({
  imports: [QueuesModule, WebSocketModule],
  providers: [OutboxService, OutboxPublisherService],
  exports: [OutboxService],
})
export class OutboxModule {}
