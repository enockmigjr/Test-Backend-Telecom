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

export class TicketCreatedEvent {
  constructor(
    public readonly ticket: Record<string, unknown>,
    public readonly userId: string,
  ) {}
}

export class TicketStatusChangedEvent {
  constructor(
    public readonly ticketId: string,
    public readonly oldStatus: string,
    public readonly newStatus: string,
    public readonly userId: string,
  ) {}
}

export class TicketAssignedEvent {
  constructor(
    public readonly ticketId: string,
    public readonly assignedTo: string,
    public readonly assignedBy: string,
  ) {}
}

export class TicketEscalatedEvent {
  constructor(
    public readonly ticketId: string,
    public readonly escalatedTo: string,
    public readonly escalatedBy: string,
  ) {}
}

export class TicketResolvedEvent {
  constructor(
    public readonly ticketId: string,
    public readonly resolvedBy: string,
  ) {}
}

export class TicketClosedEvent {
  constructor(
    public readonly ticketId: string,
    public readonly closedBy: string,
  ) {}
}

export class TicketReopenedEvent {
  constructor(
    public readonly ticketId: string,
    public readonly reopenedBy: string,
  ) {}
}

export class TicketCancelledEvent {
  constructor(
    public readonly ticketId: string,
    public readonly cancelledBy: string,
  ) {}
}

export class TicketDeassignedEvent {
  constructor(
    public readonly ticketId: string,
    public readonly deassignedAgentId: string,
    public readonly reason: string,
    public readonly departmentId: string,
  ) {}
}
