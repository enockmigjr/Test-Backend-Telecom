/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { InternalNotesController } from './internal-notes.controller';
import { InternalNotesService } from './internal-notes.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { mock, MockProxy } from 'jest-mock-extended';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const mockUser: JwtPayload = {
  sub: 'user-001',
  email: 'noc@telecom.local',
  role: 'NOC_ENGINEER',
  departmentId: 'dept-001',
  jti: 'jti-001',
};

const mockAdmin: JwtPayload = {
  sub: 'admin-001',
  email: 'admin@telecom.local',
  role: 'ADMINISTRATOR',
  departmentId: 'dept-001',
  jti: 'jti-002',
};

const mockFieldTech: JwtPayload = {
  sub: 'field-001',
  email: 'field@telecom.local',
  role: 'FIELD_TECHNICIAN',
  departmentId: 'dept-002',
  jti: 'jti-003',
};

const paginatedResult = {
  data: [
    {
      id: 'note-001',
      ticketId: 'ticket-001',
      authorId: 'user-001',
      content: 'Note interne test.',
      createdAt: new Date('2026-01-01'),
      authorName: 'Noc Engineer',
    },
  ],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

const createResult = {
  message: 'Note interne ajoutée.',
  data: {
    id: 'new-note',
    ticketId: 'ticket-001',
    authorId: 'user-001',
    content: 'Nouvelle note interne',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  },
};

const updateResult = {
  message: 'Note interne mise à jour.',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('InternalNotesController', () => {
  let controller: InternalNotesController;
  let notesService: MockProxy<InternalNotesService>;

  beforeEach(async () => {
    notesService = mock<InternalNotesService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalNotesController],
      providers: [{ provide: InternalNotesService, useValue: notesService }],
    }).compile();

    controller = module.get<InternalNotesController>(InternalNotesController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // findAll()
  // =========================================================================
  describe('GET tickets/:ticketId/internal-notes', () => {
    it('doit retourner la liste paginée des notes internes', async () => {
      notesService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll('ticket-001', { page: 1, limit: 20 });

      expect(notesService.findAll).toHaveBeenCalledWith('ticket-001', 1, 20);
      expect(result).toEqual(paginatedResult);
    });

    it('doit transmettre la pagination', async () => {
      notesService.findAll.mockResolvedValue(paginatedResult);

      await controller.findAll('ticket-001', { page: 2, limit: 10 });

      expect(notesService.findAll).toHaveBeenCalledWith('ticket-001', 2, 10);
    });
  });

  // =========================================================================
  // create()
  // =========================================================================
  describe('POST tickets/:ticketId/internal-notes', () => {
    it('doit créer une note interne', async () => {
      notesService.create.mockResolvedValue(createResult);

      const result = await controller.create('ticket-001', { content: 'Nouvelle note interne' }, mockUser);

      expect(notesService.create).toHaveBeenCalledWith(
        'ticket-001',
        mockUser.sub,
        'Nouvelle note interne',
        mockUser.role,
      );
      expect(result).toEqual(createResult);
    });

    it("doit utiliser le rôle de l'utilisateur", async () => {
      notesService.create.mockResolvedValue(createResult);

      await controller.create('ticket-001', { content: 'Note admin' }, mockAdmin);

      expect(notesService.create).toHaveBeenCalledWith('ticket-001', mockAdmin.sub, 'Note admin', mockAdmin.role);
    });

    it('doit propager ForbiddenException pour FIELD_TECHNICIAN', async () => {
      notesService.create.mockRejectedValue(
        new Error('Les techniciens terrain ne peuvent pas créer de notes internes.'),
      );

      await expect(controller.create('ticket-001', { content: 'Note interdite' }, mockFieldTech)).rejects.toThrow();
    });
  });

  // =========================================================================
  // update()
  // =========================================================================
  describe('PATCH internal-notes/:id', () => {
    it('doit mettre à jour une note interne', async () => {
      notesService.update.mockResolvedValue(updateResult);

      const result = await controller.update('note-001', { content: 'Contenu modifié' }, mockUser);

      expect(notesService.update).toHaveBeenCalledWith('note-001', mockUser.sub, mockUser.role, 'Contenu modifié');
      expect(result).toEqual(updateResult);
    });

    it('doit utiliser le rôle ADMINISTRATOR pour les admin', async () => {
      notesService.update.mockResolvedValue(updateResult);

      await controller.update('note-001', { content: 'Admin edit' }, mockAdmin);

      expect(notesService.update).toHaveBeenCalledWith('note-001', mockAdmin.sub, mockAdmin.role, 'Admin edit');
    });
  });

  // =========================================================================
  // remove()
  // =========================================================================
  describe('DELETE internal-notes/:id', () => {
    it('doit supprimer une note interne et retourner 204', async () => {
      notesService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('note-001', mockUser);

      expect(notesService.remove).toHaveBeenCalledWith('note-001', mockUser.sub, mockUser.role);
      expect(result).toBeUndefined();
    });

    it('doit gérer la suppression par un administrateur', async () => {
      notesService.remove.mockResolvedValue(undefined);

      await controller.remove('note-other', mockAdmin);

      expect(notesService.remove).toHaveBeenCalledWith('note-other', mockAdmin.sub, mockAdmin.role);
    });

    it('doit propager les erreurs du service', async () => {
      notesService.remove.mockRejectedValue(new Error('Erreur'));

      await expect(controller.remove('inexistant', mockUser)).rejects.toThrow('Erreur');
    });
  });
});
