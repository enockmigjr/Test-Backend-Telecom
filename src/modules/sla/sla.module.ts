import { Module } from '@nestjs/common';
import { SlaPoliciesController } from './sla-policies.controller';
import { SlaPoliciesService } from './sla-policies.service';
import { SlaEngineService } from './sla-engine.service';

@Module({
  controllers: [SlaPoliciesController],
  providers: [SlaPoliciesService, SlaEngineService],
  exports: [SlaPoliciesService, SlaEngineService],
})
export class SlaModule {}
