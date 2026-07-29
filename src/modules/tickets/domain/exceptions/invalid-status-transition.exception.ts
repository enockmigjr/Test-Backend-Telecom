/**
 * ============================================================================
 * FICHIER : src/modules/tickets/domain/exceptions/invalid-status-transition.exception.ts
 * RÔLE : Définitions de types, interfaces ou règles de domaine TypeScript.
 * EXPLICATION :
 * Ce fichier définit les structures de données, types stricts ou exceptions métier du domaine.
 * 1. Assure la cohérence des types à travers tout l'applicatif.
 * 2. Facilite l'auto-complétion et la détection d'erreurs à la compilation.
 * ============================================================================
 */

import { BadRequestException } from '@nestjs/common';
import { TicketStatus, TICKET_TRANSITIONS } from '../ticket-status-transitions';

export class InvalidStatusTransitionException extends BadRequestException {
  constructor(from: TicketStatus, to: TicketStatus) {
    const allowed = TICKET_TRANSITIONS[from]?.join(', ') || 'aucune';
    super(`Transition de statut invalide : ${from} → ${to}. Transitions autorisées depuis ${from}: ${allowed}`);
  }
}
