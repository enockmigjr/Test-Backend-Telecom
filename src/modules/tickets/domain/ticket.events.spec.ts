/**
 * ============================================================================
 * FICHIER : src/modules/tickets/domain/ticket.events.spec.ts
 * RÔLE : Suite de tests unitaires pour le composant ticket.events.
 * EXPLICATION :
 * Ce fichier contient les tests automatisés validant le comportement et l'intégrité de ticket.events.
 * 1. Vérifie le fonctionnement nominal et les cas d'erreur.
 * 2. Garantit qu'aucune régression n'est introduite lors des évolutions du code.
 * ============================================================================
 */

import {
  TicketCreatedEvent,
  TicketStatusChangedEvent,
  TicketAssignedEvent,
  TicketEscalatedEvent,
  TicketResolvedEvent,
  TicketClosedEvent,
  TicketReopenedEvent,
  TicketCancelledEvent,
} from './ticket.events';

/**
 * Tests unitaires des evenements de domaine des tickets.
 *
 * Les evenements de domaine sont emis via EventEmitter2 pour declencher
 * des traitements asynchrones (notifications, audit, mise a jour SLA).
 * Chaque classe d'evenement doit correctement encapsuler les donnees
 * necessaires a son traitement.
 */
describe('Ticket Events — Evenements de domaine', () => {
  const fakeTicketId = '0192abcd-1234-7000-8000-000000000001';
  const fakeUserId = '0192abcd-1234-7000-8000-000000000002';
  const fakeTicket = { id: fakeTicketId, title: 'Incident Test' } as Record<string, unknown>;

  describe('TicketCreatedEvent', () => {
    /** Test : doit accepter un ticket et un userId */
    it('doit accepter un ticket et un userId', () => {
      const event = new TicketCreatedEvent(fakeTicket, fakeUserId);

      expect(event.ticket).toBe(fakeTicket);
      expect(event.userId).toBe(fakeUserId);
    });

    /** Test : doit exposer les proprietes en readonly */

    it('doit exposer les proprietes en readonly', () => {
      const event = new TicketCreatedEvent(fakeTicket, fakeUserId);

      expect(event.ticket.id).toBe(fakeTicketId);
      expect(event.userId).toBe(fakeUserId);
    });
  });

  describe('TicketStatusChangedEvent', () => {
    /** Test : doit accepter ticketId, oldStatus, newStatus et userId */
    it('doit accepter ticketId, oldStatus, newStatus et userId', () => {
      const event = new TicketStatusChangedEvent(fakeTicketId, 'NEW', 'ASSIGNED', fakeUserId);

      expect(event.ticketId).toBe(fakeTicketId);
      expect(event.oldStatus).toBe('NEW');
      expect(event.newStatus).toBe('ASSIGNED');
      expect(event.userId).toBe(fakeUserId);
    });

    it("doit fonctionner avec n'importe quelle transition de statut", () => {
      const event = new TicketStatusChangedEvent(fakeTicketId, 'RESOLVED', 'CLOSED', fakeUserId);

      expect(event.oldStatus).toBe('RESOLVED');
      expect(event.newStatus).toBe('CLOSED');
    });
  });

  describe('TicketAssignedEvent', () => {
    /** Test : doit accepter ticketId, assignedTo et assignedBy */
    it('doit accepter ticketId, assignedTo et assignedBy', () => {
      const event = new TicketAssignedEvent(fakeTicketId, 'agent-1', 'supervisor-1');

      expect(event.ticketId).toBe(fakeTicketId);
      expect(event.assignedTo).toBe('agent-1');
      expect(event.assignedBy).toBe('supervisor-1');
    });
  });

  describe('TicketEscalatedEvent', () => {
    /** Test : doit accepter ticketId, escalatedTo et escalatedBy */
    it('doit accepter ticketId, escalatedTo et escalatedBy', () => {
      const event = new TicketEscalatedEvent(fakeTicketId, 'senior-engineer', 'supervisor-1');

      expect(event.ticketId).toBe(fakeTicketId);
      expect(event.escalatedTo).toBe('senior-engineer');
      expect(event.escalatedBy).toBe('supervisor-1');
    });
  });

  describe('TicketResolvedEvent', () => {
    /** Test : doit accepter ticketId et resolvedBy */
    it('doit accepter ticketId et resolvedBy', () => {
      const event = new TicketResolvedEvent(fakeTicketId, 'noc-engineer');

      expect(event.ticketId).toBe(fakeTicketId);
      expect(event.resolvedBy).toBe('noc-engineer');
    });
  });

  describe('TicketClosedEvent', () => {
    /** Test : doit accepter ticketId et closedBy */
    it('doit accepter ticketId et closedBy', () => {
      const event = new TicketClosedEvent(fakeTicketId, 'supervisor-1');

      expect(event.ticketId).toBe(fakeTicketId);
      expect(event.closedBy).toBe('supervisor-1');
    });
  });

  describe('TicketReopenedEvent', () => {
    /** Test : doit accepter ticketId et reopenedBy */
    it('doit accepter ticketId et reopenedBy', () => {
      const event = new TicketReopenedEvent(fakeTicketId, 'agent-1');

      expect(event.ticketId).toBe(fakeTicketId);
      expect(event.reopenedBy).toBe('agent-1');
    });
  });

  describe('TicketCancelledEvent', () => {
    /** Test : doit accepter ticketId et cancelledBy */
    it('doit accepter ticketId et cancelledBy', () => {
      const event = new TicketCancelledEvent(fakeTicketId, 'supervisor-1');

      expect(event.ticketId).toBe(fakeTicketId);
      expect(event.cancelledBy).toBe('supervisor-1');
    });
  });

  describe('Tous les evenements — Interface commune', () => {
    /** Test : doit etre des instances de leur classe respective */
    it('doit etre des instances de leur classe respective', () => {
      expect(new TicketCreatedEvent(fakeTicket, fakeUserId)).toBeInstanceOf(TicketCreatedEvent);
      expect(new TicketStatusChangedEvent(fakeTicketId, 'A', 'B', fakeUserId)).toBeInstanceOf(TicketStatusChangedEvent);
      expect(new TicketAssignedEvent(fakeTicketId, 'a', 'b')).toBeInstanceOf(TicketAssignedEvent);
      expect(new TicketEscalatedEvent(fakeTicketId, 'a', 'b')).toBeInstanceOf(TicketEscalatedEvent);
      expect(new TicketResolvedEvent(fakeTicketId, 'a')).toBeInstanceOf(TicketResolvedEvent);
      expect(new TicketClosedEvent(fakeTicketId, 'a')).toBeInstanceOf(TicketClosedEvent);
      expect(new TicketReopenedEvent(fakeTicketId, 'a')).toBeInstanceOf(TicketReopenedEvent);
      expect(new TicketCancelledEvent(fakeTicketId, 'a')).toBeInstanceOf(TicketCancelledEvent);
    });
  });
});
