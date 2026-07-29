/**
 * ============================================================================
 * FICHIER : src/modules/comments/comments.service.spec.ts
 * RÔLE : Suite de tests unitaires pour le composant comments.service.
 * EXPLICATION :
 * Ce fichier contient les tests automatisés validant le comportement et l'intégrité de comments.service.
 * 1. Vérifie le fonctionnement nominal et les cas d'erreur.
 * 2. Garantit qu'aucune régression n'est introduite lors des évolutions du code.
 * ============================================================================
 */

import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TicketAccessService } from '../../common/services/ticket-access.service';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CommentsService } from './comments.service';

const user: JwtPayload = {
  sub: 'agent-001',
  email: 'agent@telecom.local',
  role: 'CUSTOMER_SERVICE_AGENT',
  departmentId: 'dept-001',
  mustChangePassword: false,
  jti: 'jti-001',
};

function query<T>(rows: T[]): Record<string, jest.Mock> {
  const builder: Record<string, jest.Mock> = {};
  for (const method of ['from', 'leftJoin', 'where', 'orderBy', 'limit', 'offset']) {
    builder[method] = jest.fn(() => builder);
  }
  builder['then'] = jest.fn((resolve: (value: T[]) => void) => resolve(rows));
  return builder;
}

describe('CommentsService - isolation ticket', () => {
  const select = jest.fn();
  const insertValues = jest.fn().mockResolvedValue(undefined);
  const db = {
    select,
    insert: jest.fn(() => ({ values: insertValues })),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const ticketAccess = { assertTicketVisible: jest.fn() };
  let service: CommentsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    ticketAccess.assertTicketVisible.mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: DrizzleProvider, useValue: { db } },
        { provide: TicketAccessService, useValue: ticketAccess },
      ],
    }).compile();
    service = moduleRef.get(CommentsService);
  });

  /** Test : refuse la liste avant toute lecture quand le ticket est hors scope */

  it('refuse la liste avant toute lecture quand le ticket est hors scope', async () => {
    ticketAccess.assertTicketVisible.mockRejectedValue(new ForbiddenException());
    await expect(service.findAll('ticket-other', user)).rejects.toBeInstanceOf(ForbiddenException);
    expect(select).not.toHaveBeenCalled();
  });

  /** Test : borne la pagination et lit seulement apres autorisation */

  it('borne la pagination et lit seulement apres autorisation', async () => {
    const countQuery = query([{ count: 0 }]);
    const dataQuery = query([]);
    select.mockReturnValueOnce(countQuery).mockReturnValueOnce(dataQuery);
    const result = await service.findAll('ticket-001', user, 0, 500);
    expect(ticketAccess.assertTicketVisible).toHaveBeenCalledWith('ticket-001', user);
    expect(dataQuery['limit']).toHaveBeenCalledWith(100);
    expect(result.meta).toEqual({ page: 1, limit: 100, total: 0, totalPages: 0 });
  });

  /** Test : refuse la creation hors scope sans insertion */

  it('refuse la creation hors scope sans insertion', async () => {
    ticketAccess.assertTicketVisible.mockRejectedValue(new ForbiddenException());
    await expect(service.create('ticket-other', user, 'Contenu')).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.insert).not.toHaveBeenCalled();
  });

  /** Test : refuse la modification hors scope avant toute ecriture */

  it('refuse la modification hors scope avant toute ecriture', async () => {
    select.mockReturnValueOnce(query([{ id: 'comment-001', ticketId: 'ticket-other', authorId: user.sub }]));
    ticketAccess.assertTicketVisible.mockRejectedValue(new ForbiddenException());

    await expect(service.update('comment-001', user, 'Modification')).rejects.toBeInstanceOf(ForbiddenException);

    expect(db.update).not.toHaveBeenCalled();
  });

  /** Test : refuse la suppression hors scope avant toute ecriture */

  it('refuse la suppression hors scope avant toute ecriture', async () => {
    select.mockReturnValueOnce(query([{ id: 'comment-001', ticketId: 'ticket-other', authorId: user.sub }]));
    ticketAccess.assertTicketVisible.mockRejectedValue(new ForbiddenException());

    await expect(service.remove('comment-001', user)).rejects.toBeInstanceOf(ForbiddenException);

    expect(db.delete).not.toHaveBeenCalled();
  });
});
