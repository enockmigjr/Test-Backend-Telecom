import { Injectable } from '@nestjs/common';
import { InvalidStatusTransitionException } from './exceptions/invalid-status-transition.exception';

/**
 * Statuts de ticket.
 */
export type TicketStatus =
  | 'NEW'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'PENDING_CUSTOMER'
  | 'PENDING_THIRD_PARTY'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REOPENED'
  | 'CANCELLED';

/**
 * Map immuable des transitions de statut valides.
 * Toute transition non listée ici est interdite.
 */
export const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  NEW: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['PENDING_CUSTOMER', 'PENDING_THIRD_PARTY', 'RESOLVED'],
  PENDING_CUSTOMER: ['IN_PROGRESS', 'RESOLVED'],
  PENDING_THIRD_PARTY: ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['CLOSED', 'REOPENED'],
  CLOSED: ['REOPENED'],
  REOPENED: ['IN_PROGRESS', 'CANCELLED'],
  CANCELLED: [],
};

/**
 * Service de validation des transitions de statut.
 */
@Injectable()
export class TicketStateMachine {
  /**
   * Vérifie si une transition est autorisée.
   */
  canTransition(from: TicketStatus, to: TicketStatus): boolean {
    const allowed = TICKET_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
  }

  /**
   * Valide une transition. Lève une exception si invalide.
   */
  validateTransition(from: TicketStatus, to: TicketStatus): void {
    if (!this.canTransition(from, to)) {
      throw new InvalidStatusTransitionException(from, to);
    }
  }

  /**
   * Retourne les transitions autorisées depuis un statut donné.
   */
  getAllowedTransitions(from: TicketStatus): TicketStatus[] {
    return TICKET_TRANSITIONS[from] || [];
  }
}
