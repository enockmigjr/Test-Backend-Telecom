/**
 * ============================================================================
 * FICHIER : src/modules/sla/sla-auto-close.service.ts
 * RÔLE : Service de clôture automatique des tickets d'incidents résolus depuis plus de 48 heures.
 * EXPLICATION :
 * Ce service applique la règle métier d'archivage des incidents sans contestation client :
 * 1. Détection des candidats : Filtre les tickets au statut `RESOLVED` dont l'horodatage `resolvedAt` est inférieur à 48 heures (`cutoff`).
 * 2. Traitement transactionnel : Exécute une transaction PostgreSQL basculant le statut de `RESOLVED` à `CLOSED`, enregistre `closedAt = NOW()`, et consigne la modification dans `ticketHistory`.
 * 3. Événements du domaine : Émet `ticket.status_changed` et `ticket.closed` via `EventEmitter2` pour avertir les écouteurs de notification.
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, eq, isNull, lt } from 'drizzle-orm';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { MetricsService } from '../../common/metrics/metrics.service';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { ticketHistory, tickets } from '../../database/schemas';
import { TicketClosedEvent, TicketStatusChangedEvent } from '../tickets/domain/ticket.events';
import { systemActor } from '../tickets/domain/ticket-actor';

/**
 * Service orchestrant l'auto-clôture après 48h de résolution sans intervention.
 */
@Injectable()
export class SlaAutoCloseService {
  private readonly logger = new Logger(SlaAutoCloseService.name);

  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly metricsService: MetricsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Identifie et clôture automatiquement jusqu'à 100 tickets résolus depuis plus de 48 heures.
   */
  async process(): Promise<void> {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000); // Seuil d'inactivité fixé à 48 heures
    const resolvedTickets = await this.drizzle.db
      .select({
        id: tickets.id,
        ticketNumber: tickets.ticketNumber,
        supportIntegrationId: tickets.supportIntegrationId,
      })
      .from(tickets)
      .where(and(eq(tickets.status, 'RESOLVED'), lt(tickets.resolvedAt, cutoff), isNull(tickets.deletedAt)))
      .limit(100);

    if (resolvedTickets.length === 0) return;

    for (const ticket of resolvedTickets) {
      const closedAt = new Date();
      // Transaction atomique de mise à jour et d'insertion d'historique
      const claimed = await this.drizzle.runInTransaction(async () => {
        const rows = await this.drizzle.db
          .update(tickets)
          .set({ status: 'CLOSED', closedAt })
          .where(
            and(
              eq(tickets.id, ticket.id),
              eq(tickets.status, 'RESOLVED'),
              lt(tickets.resolvedAt, cutoff),
              isNull(tickets.deletedAt),
            ),
          )
          .returning({ id: tickets.id });
        if (rows.length === 0) return false;

        await this.drizzle.db.insert(ticketHistory).values({
          id: generateUuid(),
          ticketId: ticket.id,
          userId: null,
          actorType: 'SYSTEM',
          supportIntegrationId: ticket.supportIntegrationId,
          action: 'STATUS_CHANGED',
          oldValue: { status: 'RESOLVED' },
          newValue: { status: 'CLOSED' },
          metadata: { reason: 'Clôture automatique après 48 heures de résolution sans activité.' },
        });
        this.drizzle.afterCommit(() => {
          this.eventEmitter.emit(
            'ticket.status_changed',
            new TicketStatusChangedEvent(ticket.id, 'RESOLVED', 'CLOSED', systemActor(), ticket.supportIntegrationId),
          );
          this.eventEmitter.emit(
            'ticket.closed',
            new TicketClosedEvent(ticket.id, systemActor(), ticket.supportIntegrationId),
          );
          this.metricsService.ticketsActive.dec();
          this.logger.log(`Ticket ${ticket.ticketNumber} clôturé automatiquement.`);
        });
        return true;
      });

      if (!claimed) continue;
    }
  }
}
