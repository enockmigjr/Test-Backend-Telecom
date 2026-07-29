/**
 * ============================================================================
 * FICHIER : src/modules/internal-notes/internal-notes.controller.spec.ts
 * RÔLE : Suite de tests unitaires pour le composant internal-notes.controller.
 * EXPLICATION :
 * Ce fichier contient les tests automatisés validant le comportement et l'intégrité de internal-notes.controller.
 * 1. Vérifie le fonctionnement nominal et les cas d'erreur.
 * 2. Garantit qu'aucune régression n'est introduite lors des évolutions du code.
 * ============================================================================
 */

import { Test } from '@nestjs/testing';
import { mock, MockProxy } from 'jest-mock-extended';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { InternalNotesController } from './internal-notes.controller';
import { InternalNotesService } from './internal-notes.service';

const user: JwtPayload = {
  sub: 'user-001',
  email: 'noc@telecom.local',
  role: 'NOC_ENGINEER',
  departmentId: 'dept-001',
  mustChangePassword: false,
  jti: 'jti-001',
};
const note = {
  id: 'note-001',
  ticketId: 'ticket-001',
  authorId: user.sub,
  content: 'Diagnostic interne',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('InternalNotesController', () => {
  let controller: InternalNotesController;
  let service: MockProxy<InternalNotesService>;

  beforeEach(async () => {
    service = mock<InternalNotesService>();
    const moduleRef = await Test.createTestingModule({
      controllers: [InternalNotesController],
      providers: [{ provide: InternalNotesService, useValue: service }],
    }).compile();
    controller = moduleRef.get(InternalNotesController);
  });

  /** Test : transmet utilisateur et pagination pour la liste */

  it('transmet utilisateur et pagination pour la liste', async () => {
    service.findAll.mockResolvedValue({ data: [], meta: { page: 2, limit: 10, total: 0, totalPages: 0 } });
    await controller.findAll('ticket-001', { page: 2, limit: 10 }, user);
    expect(service.findAll).toHaveBeenCalledWith('ticket-001', user, 2, 10);
  });

  /** Test : transmet le contexte utilisateur pour la creation */

  it('transmet le contexte utilisateur pour la creation', async () => {
    service.create.mockResolvedValue({ message: 'Note interne ajoutee.', data: note });
    await controller.create('ticket-001', { content: 'Diagnostic interne' }, user);
    expect(service.create).toHaveBeenCalledWith('ticket-001', user, 'Diagnostic interne');
  });

  /** Test : transmet le contexte utilisateur pour la modification */

  it('transmet le contexte utilisateur pour la modification', async () => {
    service.update.mockResolvedValue({ message: 'Note interne mise a jour.', data: note });
    await controller.update('note-001', { content: 'Diagnostic corrige' }, user);
    expect(service.update).toHaveBeenCalledWith('note-001', user, 'Diagnostic corrige');
  });

  /** Test : transmet le contexte utilisateur pour la suppression */

  it('transmet le contexte utilisateur pour la suppression', async () => {
    service.remove.mockResolvedValue(undefined);
    await controller.remove('note-001', user);
    expect(service.remove).toHaveBeenCalledWith('note-001', user);
  });
});
