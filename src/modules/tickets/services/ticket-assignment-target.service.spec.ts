/**
 * ============================================================================
 * FICHIER : src/modules/tickets/services/ticket-assignment-target.service.spec.ts
 * RÔLE : Suite de tests unitaires pour le composant ticket-assignment-target.service.
 * EXPLICATION :
 * Ce fichier contient les tests automatisés validant le comportement et l'intégrité de ticket-assignment-target.service.
 * 1. Vérifie le fonctionnement nominal et les cas d'erreur.
 * 2. Garantit qu'aucune régression n'est introduite lors des évolutions du code.
 * ============================================================================
 */

import { BadRequestException } from '@nestjs/common';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { TicketAssignmentTargetService } from './ticket-assignment-target.service';

describe('TicketAssignmentTargetService', () => {
  const limit = jest.fn();
  const db = {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({ limit })),
      })),
    })),
  };
  let service: TicketAssignmentTargetService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TicketAssignmentTargetService({ db } as unknown as DrizzleProvider);
  });

  /** Test : accepte uniquement une cible active du departement attendu */

  it('accepte uniquement une cible active du departement attendu', async () => {
    limit.mockResolvedValue([{ id: 'user-001' }]);

    await expect(service.assertEligible('user-001', 'dept-001')).resolves.toBeUndefined();
  });

  /** Test : refuse une cible absente, inactive, supprimee ou hors departement */

  it('refuse une cible absente, inactive, supprimee ou hors departement', async () => {
    limit.mockResolvedValue([]);

    await expect(service.assertEligible('user-002', 'dept-001')).rejects.toBeInstanceOf(BadRequestException);
  });
});
