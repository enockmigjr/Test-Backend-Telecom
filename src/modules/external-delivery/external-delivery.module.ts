import { forwardRef, Module } from '@nestjs/common';
import { QueuesModule } from '../../queues/queues.module';
import { SupportIntegrationsModule } from '../support-integrations/support-integrations.module';
import { EmailChannelAdapter } from './adapters/email-channel.adapter';
import { ExternalDeliveriesAdminController } from './external-deliveries.admin.controller';
import { EMAIL_CHANNEL_ADAPTER } from './interfaces/channel-adapter.interface';
import { ExternalDeliveryService } from './services/external-delivery.service';

@Module({
  imports: [forwardRef(() => QueuesModule), SupportIntegrationsModule],
  controllers: [ExternalDeliveriesAdminController],
  providers: [
    ExternalDeliveryService,
    EmailChannelAdapter,
    { provide: EMAIL_CHANNEL_ADAPTER, useExisting: EmailChannelAdapter },
  ],
  exports: [ExternalDeliveryService],
})
export class ExternalDeliveryModule {}
