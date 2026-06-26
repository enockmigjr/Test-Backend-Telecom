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
