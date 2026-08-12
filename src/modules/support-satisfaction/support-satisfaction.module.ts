import { Module } from '@nestjs/common';
import { SupportSatisfactionService } from './support-satisfaction.service';
import { InternalSatisfactionController, PublicSatisfactionController } from './support-satisfaction.controller';
import { TicketSatisfactionListener } from './ticket-satisfaction.listener';

@Module({
  controllers: [PublicSatisfactionController, InternalSatisfactionController],
  providers: [SupportSatisfactionService, TicketSatisfactionListener],
  exports: [SupportSatisfactionService],
})
export class SupportSatisfactionModule {}
