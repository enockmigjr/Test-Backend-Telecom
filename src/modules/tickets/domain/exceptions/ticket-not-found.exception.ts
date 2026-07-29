/**
 * ============================================================================
 * FICHIER : src/modules/tickets/domain/exceptions/ticket-not-found.exception.ts
 * RÔLE : Définitions de types, interfaces ou règles de domaine TypeScript.
 * EXPLICATION :
 * Ce fichier définit les structures de données, types stricts ou exceptions métier du domaine.
 * 1. Assure la cohérence des types à travers tout l'applicatif.
 * 2. Facilite l'auto-complétion et la détection d'erreurs à la compilation.
 * ============================================================================
 */

import { NotFoundException } from '@nestjs/common';

export class TicketNotFoundException extends NotFoundException {
  constructor(id?: string) {
    super(id ? `Ticket non trouvé : ${id}` : 'Ticket non trouvé.');
  }
}
