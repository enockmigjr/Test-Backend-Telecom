import { Module } from '@nestjs/common';
import { QueuesModule } from '../../queues/queues.module';
import { ExternalDeliveryWorker } from '../../queues/workers/external-delivery.worker';
import { SupportIntegrationsModule } from '../support-integrations/support-integrations.module';
import { EmailChannelAdapter } from './adapters/email-channel.adapter';
import { EMAIL_CHANNEL_ADAPTER } from './interfaces/channel-adapter.interface';
import { ExternalDeliveryService } from './services/external-delivery.service';

@Module({
  imports: [QueuesModule, SupportIntegrationsModule],
  providers: [
    ExternalDeliveryService,
    ExternalDeliveryWorker,
    EmailChannelAdapter,
    { provide: EMAIL_CHANNEL_ADAPTER, useExisting: EmailChannelAdapter },
  ],
  exports: [ExternalDeliveryService],
})
export class ExternalDeliveryModule {}
