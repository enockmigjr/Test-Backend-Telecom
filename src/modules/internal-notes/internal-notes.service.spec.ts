/**
 * ============================================================================
 * FICHIER : src/modules/internal-notes/internal-notes.service.spec.ts
 * RÔLE : Suite de tests unitaires pour le composant internal-notes.service.
 * EXPLICATION :
 * Ce fichier contient les tests automatisés validant le comportement et l'intégrité de internal-notes.service.
 * 1. Vérifie le fonctionnement nominal et les cas d'erreur.
 * 2. Garantit qu'aucune régression n'est introduite lors des évolutions du code.
 * ============================================================================
 */

import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TicketAccessService } from '../../common/services/ticket-access.service';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { InternalNotesService } from './internal-notes.service';

const agent: JwtPayload = {
  sub: 'agent-001',
  email: 'noc@telecom.local',
  role: 'NOC_ENGINEER',
  departmentId: 'dept-001',
  mustChangePassword: false,
  jti: 'jti-001',
};
const fieldTechnician: JwtPayload = { ...agent, sub: 'field-001', role: 'FIELD_TECHNICIAN' };

function query<T>(rows: T[]): Record<string, jest.Mock> {
  const builder: Record<string, jest.Mock> = {};
  for (const method of ['from', 'where', 'leftJoin', 'orderBy', 'limit', 'offset']) {
    builder[method] = jest.fn(() => builder);
  }
  builder['then'] = jest.fn((resolve: (value: T[]) => void) => resolve(rows));
  return builder;
}

describe('InternalNotesService - isolation ticket', () => {
  const select = jest.fn();
  const db = { select, insert: jest.fn(), update: jest.fn(), delete: jest.fn() };
  const ticketAccess = { assertTicketVisible: jest.fn() };
  let service: InternalNotesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    ticketAccess.assertTicketVisible.mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [
        InternalNotesService,
        { provide: DrizzleProvider, useValue: { db } },
        { provide: TicketAccessService, useValue: ticketAccess },
      ],
    }).compile();
    service = moduleRef.get(InternalNotesService);
  });

  /** Test : refuse toujours un technicien terrain avant la base */

  it('refuse toujours un technicien terrain avant la base', async () => {
    await expect(service.findAll('ticket-001', fieldTechnician)).rejects.toBeInstanceOf(ForbiddenException);
    expect(ticketAccess.assertTicketVisible).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
  });

  /** Test : refuse une liste hors scope avant de lire les notes */

  it('refuse une liste hors scope avant de lire les notes', async () => {
    ticketAccess.assertTicketVisible.mockRejectedValue(new ForbiddenException());
    await expect(service.findAll('ticket-other', agent)).rejects.toBeInstanceOf(ForbiddenException);
    expect(select).not.toHaveBeenCalled();
  });

  /** Test : borne la pagination autorisee a cent notes */

  it('borne la pagination autorisee a cent notes', async () => {
    const countQuery = query([{ count: 0 }]);
    const dataQuery = query([]);
    select.mockReturnValueOnce(countQuery).mockReturnValueOnce(dataQuery);
    const result = await service.findAll('ticket-001', agent, -1, 1000);
    expect(dataQuery['limit']).toHaveBeenCalledWith(100);
    expect(result.meta.page).toBe(1);
    expect(result.meta.limit).toBe(100);
  });

  /** Test : refuse une creation hors scope avant toute insertion */

  it('refuse une creation hors scope avant toute insertion', async () => {
    ticketAccess.assertTicketVisible.mockRejectedValue(new ForbiddenException());

    await expect(service.create('ticket-other', agent, 'Note')).rejects.toBeInstanceOf(ForbiddenException);

    expect(db.insert).not.toHaveBeenCalled();
  });

  /** Test : refuse la modification hors scope avant toute ecriture */

  it('refuse la modification hors scope avant toute ecriture', async () => {
    select.mockReturnValueOnce(query([{ id: 'note-001', ticketId: 'ticket-other', authorId: agent.sub }]));
    ticketAccess.assertTicketVisible.mockRejectedValue(new ForbiddenException());

    await expect(service.update('note-001', agent, 'Modification')).rejects.toBeInstanceOf(ForbiddenException);

    expect(db.update).not.toHaveBeenCalled();
  });

  /** Test : refuse la suppression hors scope avant toute ecriture */

  it('refuse la suppression hors scope avant toute ecriture', async () => {
    select.mockReturnValueOnce(query([{ id: 'note-001', ticketId: 'ticket-other', authorId: agent.sub }]));
    ticketAccess.assertTicketVisible.mockRejectedValue(new ForbiddenException());

    await expect(service.remove('note-001', agent)).rejects.toBeInstanceOf(ForbiddenException);

    expect(db.delete).not.toHaveBeenCalled();
  });
});
