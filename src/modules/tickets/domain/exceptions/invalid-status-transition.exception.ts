import { BadRequestException } from '@nestjs/common';
import { TicketStatus, TICKET_TRANSITIONS } from '../ticket-status-transitions';

export class InvalidStatusTransitionException extends BadRequestException {
  constructor(from: TicketStatus, to: TicketStatus) {
    const allowed = TICKET_TRANSITIONS[from]?.join(', ') || 'aucune';
    super(`Transition de statut invalide : ${from} → ${to}. Transitions autorisées depuis ${from}: ${allowed}`);
  }
}
