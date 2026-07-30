/**
 * ============================================================================
 * FICHIER : src/modules/tickets/domain/ticket.events.ts
 * RÔLE : Définitions de types, interfaces ou règles de domaine TypeScript.
 * EXPLICATION :
 * Ce fichier définit les structures de données, types stricts ou exceptions métier du domaine.
 * 1. Assure la cohérence des types à travers tout l'applicatif.
 * 2. Facilite l'auto-complétion et la détection d'erreurs à la compilation.
 * ============================================================================
 */

/**
 * Événements de domaine pour le cycle de vie des tickets.
 * Émis via EventEmitter2 pour un traitement asynchrone découplé
 * (notifications, audit, historique, SLA, WebSocket).
 */
import { internalActor, TicketActor } from './ticket-actor';

function normalizeActor(actor: string | TicketActor): TicketActor {
  return typeof actor === 'string' ? internalActor(actor) : actor;
}

function internalUserId(actor: TicketActor): string | null {
  return actor.type === 'INTERNAL' ? actor.userId : null;
}

export class TicketCreatedEvent {
  readonly actor: TicketActor;
  readonly userId: string | null;
  readonly supportIntegrationId: string | null;
  constructor(
    public readonly ticket: Record<string, unknown>,
    actor: string | TicketActor,
  ) {
    this.actor = normalizeActor(actor);
    this.userId = internalUserId(this.actor);
    this.supportIntegrationId =
      typeof ticket['supportIntegrationId'] === 'string' ? ticket['supportIntegrationId'] : null;
  }
}

export class TicketStatusChangedEvent {
  readonly actor: TicketActor;
  readonly userId: string | null;
  constructor(
    public readonly ticketId: string,
    public readonly oldStatus: string,
    public readonly newStatus: string,
    actor: string | TicketActor,
    public readonly supportIntegrationId: string | null = null,
  ) {
    this.actor = normalizeActor(actor);
    this.userId = internalUserId(this.actor);
  }
}

export class TicketAssignedEvent {
  readonly actor: TicketActor;
  readonly assignedBy: string | null;
  constructor(
    public readonly ticketId: string,
    public readonly assignedTo: string,
    actor: string | TicketActor,
    public readonly supportIntegrationId: string | null = null,
  ) {
    this.actor = normalizeActor(actor);
    this.assignedBy = internalUserId(this.actor);
  }
}

export class TicketEscalatedEvent {
  readonly actor: TicketActor;
  readonly escalatedBy: string | null;
  constructor(
    public readonly ticketId: string,
    public readonly escalatedTo: string,
    actor: string | TicketActor,
    public readonly supportIntegrationId: string | null = null,
  ) {
    this.actor = normalizeActor(actor);
    this.escalatedBy = internalUserId(this.actor);
  }
}

export class TicketResolvedEvent {
  readonly actor: TicketActor;
  readonly resolvedBy: string | null;
  constructor(
    public readonly ticketId: string,
    actor: string | TicketActor,
    public readonly supportIntegrationId: string | null = null,
  ) {
    this.actor = normalizeActor(actor);
    this.resolvedBy = internalUserId(this.actor);
  }
}

export class TicketClosedEvent {
  readonly actor: TicketActor;
  readonly closedBy: string | null;
  constructor(
    public readonly ticketId: string,
    actor: string | TicketActor,
    public readonly supportIntegrationId: string | null = null,
  ) {
    this.actor = normalizeActor(actor);
    this.closedBy = internalUserId(this.actor);
  }
}

export class TicketReopenedEvent {
  readonly actor: TicketActor;
  readonly reopenedBy: string | null;
  constructor(
    public readonly ticketId: string,
    actor: string | TicketActor,
    public readonly supportIntegrationId: string | null = null,
  ) {
    this.actor = normalizeActor(actor);
    this.reopenedBy = internalUserId(this.actor);
  }
}

export class TicketCancelledEvent {
  readonly actor: TicketActor;
  readonly cancelledBy: string | null;
  constructor(
    public readonly ticketId: string,
    actor: string | TicketActor,
    public readonly supportIntegrationId: string | null = null,
  ) {
    this.actor = normalizeActor(actor);
    this.cancelledBy = internalUserId(this.actor);
  }
}

export class TicketDeassignedEvent {
  constructor(
    public readonly ticketId: string,
    public readonly deassignedAgentId: string,
    public readonly reason: string,
    public readonly departmentId: string,
  ) {}
}
