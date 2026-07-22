import { Module } from '@nestjs/common';
import { SlaPoliciesController } from './sla-policies.controller';
import { SlaPoliciesService } from './sla-policies.service';
import { SlaEngineService } from './sla-engine.service';
import { WebSocketModule } from '../../websocket/websocket.module';
import { SlaAlertNotifierService } from './sla-alert-notifier.service';
import { SlaAlertProcessorService } from './sla-alert-processor.service';
import { SlaAutoCloseService } from './sla-auto-close.service';

/**
 * Module SLA.
 * Importe WebSocketModule pour que SlaEngineService puisse émettre
 * des alertes en temps réel aux utilisateurs concernés.
 */
@Module({
  imports: [WebSocketModule],
  controllers: [SlaPoliciesController],
  providers: [
    SlaPoliciesService,
    SlaEngineService,
    SlaAlertNotifierService,
    SlaAlertProcessorService,
    SlaAutoCloseService,
  ],
  exports: [SlaPoliciesService, SlaEngineService],
})
export class SlaModule {}
