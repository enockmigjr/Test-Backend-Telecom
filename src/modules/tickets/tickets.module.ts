import { Module } from '@nestjs/common';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './services/tickets.service';
import { TicketsSearchService } from './services/tickets-search.service';
import { TicketNumberService } from './services/ticket-number.service';
import { TicketHistoryService } from './services/ticket-history.service';
import { TicketStateMachine } from './domain/ticket-status-transitions';
import { TicketNotificationListener } from './listeners/ticket-notification.listener';
import { TicketAuditListener } from './listeners/ticket-audit.listener';
import { TicketSlaListener } from './listeners/ticket-sla.listener';
import { WebSocketModule } from '../../websocket/websocket.module';

/**
 * Module Tickets — cœur métier de la plateforme.
 *
 * Importe WebSocketModule pour que TicketNotificationListener
 * puisse émettre des événements temps réel via TelecomWebSocketGateway.
 *
 * Les listeners injectent 'BullMQ_Queues' via le QueuesModule global
 * (aucun import requis car @Global()).
 */
@Module({
  imports: [WebSocketModule],
  controllers: [TicketsController],
  providers: [
    TicketsService,
    TicketsSearchService,
    TicketNumberService,
    TicketHistoryService,
    TicketStateMachine,
    TicketNotificationListener,
    TicketAuditListener,
    TicketSlaListener,
  ],
  exports: [TicketsService, TicketsSearchService, TicketHistoryService],
})
export class TicketsModule {}
