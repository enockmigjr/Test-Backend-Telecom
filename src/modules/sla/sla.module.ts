import { Module } from '@nestjs/common';
import { SlaPoliciesController } from './sla-policies.controller';
import { SlaPoliciesService } from './sla-policies.service';
import { SlaEngineService } from './sla-engine.service';
import { WebSocketModule } from '../../websocket/websocket.module';

/**
 * Module SLA.
 * Importe WebSocketModule pour que SlaEngineService puisse émettre
 * des alertes en temps réel aux utilisateurs concernés.
 */
@Module({
  imports: [WebSocketModule],
  controllers: [SlaPoliciesController],
  providers: [SlaPoliciesService, SlaEngineService],
  exports: [SlaPoliciesService, SlaEngineService],
})
export class SlaModule {}
