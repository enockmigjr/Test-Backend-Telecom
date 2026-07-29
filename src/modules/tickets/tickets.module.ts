/**
 * ============================================================================
 * FICHIER : src/modules/tickets/tickets.module.ts
 * RÔLE : Module NestJS organisant le composant tickets.
 * EXPLICATION :
 * Ce module regroupe et configure les contrôleurs, services, répertoires et dépendances de tickets.
 * 1. Définit les éléments internes du domaine fonctionnel.
 * 2. Rend les services accessibles aux autres modules ayant importé celui-ci.
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './services/tickets.service';
import { TicketsSearchService } from './services/tickets-search.service';
import { TicketNumberService } from './services/ticket-number.service';
import { TicketHistoryService } from './services/ticket-history.service';
import { AssignmentEngineService } from './services/assignment-engine.service';
import { AutoAssignmentCron } from './services/auto-assignment.cron';
import { TicketStateMachine } from './domain/ticket-status-transitions';
import { TicketPermissions } from './domain/ticket-permissions';
import { TicketNotificationListener } from './listeners/ticket-notification.listener';
import { TicketAuditListener } from './listeners/ticket-audit.listener';
import { TicketSlaListener } from './listeners/ticket-sla.listener';
import { TicketAssignmentListener } from './listeners/ticket-assignment.listener';
import { WebSocketModule } from '../../websocket/websocket.module';
import { TicketAccessService } from '../../common/services/ticket-access.service';
import { TicketDetailsService } from './services/ticket-details.service';
import { TicketAssignmentTargetService } from './services/ticket-assignment-target.service';

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
    TicketDetailsService,
    TicketAssignmentTargetService,
    TicketNumberService,
    TicketHistoryService,
    AssignmentEngineService,
    AutoAssignmentCron,
    TicketStateMachine,
    TicketPermissions,
    TicketAccessService,
    TicketNotificationListener,
    TicketAuditListener,
    TicketSlaListener,
    TicketAssignmentListener,
  ],
  exports: [TicketsService, TicketsSearchService, TicketHistoryService, TicketPermissions, AssignmentEngineService],
})
/**
 * Module NestJS `TicketsModule` configurant les dépendances, contrôleurs et services associés.
 */
export class TicketsModule {}
