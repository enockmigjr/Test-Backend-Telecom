import { Module } from '@nestjs/common';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './services/tickets.service';
import { TicketsSearchService } from './services/tickets-search.service';
import { TicketNumberService } from './services/ticket-number.service';
import { TicketHistoryService } from './services/ticket-history.service';
import { TicketStateMachine } from './domain/ticket-status-transitions';

@Module({
  controllers: [TicketsController],
  providers: [TicketsService, TicketsSearchService, TicketNumberService, TicketHistoryService, TicketStateMachine],
  exports: [TicketsService, TicketsSearchService, TicketHistoryService],
})
export class TicketsModule {}
