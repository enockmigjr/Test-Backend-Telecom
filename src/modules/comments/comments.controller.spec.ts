/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { mock, MockProxy } from 'jest-mock-extended';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const mockUser: JwtPayload = {
  sub: 'user-001',
  email: 'agent@telecom.local',
  role: 'CUSTOMER_SERVICE_AGENT',
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

const paginatedResult = {
  data: [
    {
      id: 'comment-001',
      ticketId: 'ticket-001',
      authorId: 'user-001',
      content: 'Test comment',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    },
  ],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

const createResult = {
  message: 'Commentaire ajouté avec succès.',
  data: {
    id: 'new-comment',
    ticketId: 'ticket-001',
    authorId: 'user-001',
    content: 'Nouveau commentaire',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  },
};

const updateResult = {
  message: 'Commentaire mis à jour.',
  data: {
    id: 'comment-001',
    ticketId: 'ticket-001',
    authorId: 'user-001',
    content: 'Contenu modifié',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('CommentsController', () => {
  let controller: CommentsController;
  let commentsService: MockProxy<CommentsService>;

  beforeEach(async () => {
    commentsService = mock<CommentsService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommentsController],
      providers: [{ provide: CommentsService, useValue: commentsService }],
    }).compile();

    controller = module.get<CommentsController>(CommentsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // findAll()
  // =========================================================================
  describe('GET tickets/:ticketId/comments', () => {
    it('doit retourner la liste paginée des commentaires', async () => {
      commentsService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll('ticket-001', { page: 1, limit: 20 });

      expect(commentsService.findAll).toHaveBeenCalledWith('ticket-001', 1, 20);
      expect(result).toEqual(paginatedResult);
    });

    it('doit utiliser les valeurs par défaut de pagination', async () => {
      commentsService.findAll.mockResolvedValue(paginatedResult);

      await controller.findAll('ticket-001', { page: 1, limit: 20 });

      expect(commentsService.findAll).toHaveBeenCalledWith('ticket-001', 1, 20);
    });

    it('doit transmettre la page demandée', async () => {
      commentsService.findAll.mockResolvedValue(paginatedResult);

      await controller.findAll('ticket-001', { page: 3, limit: 10 });

      expect(commentsService.findAll).toHaveBeenCalledWith('ticket-001', 3, 10);
    });
  });

  // =========================================================================
  // create()
  // =========================================================================
  describe('POST tickets/:ticketId/comments', () => {
    it('doit créer un commentaire et retourner 201', async () => {
      commentsService.create.mockResolvedValue(createResult);

      const result = await controller.create('ticket-001', { content: 'Nouveau commentaire' }, mockUser);

      expect(commentsService.create).toHaveBeenCalledWith('ticket-001', mockUser.sub, 'Nouveau commentaire');
      expect(result).toEqual(createResult);
    });

    it('doit utiliser le sub du JWT comme authorId', async () => {
      commentsService.create.mockResolvedValue(createResult);

      const result = await controller.create('ticket-001', { content: 'Test' }, mockUser);

      expect(commentsService.create).toHaveBeenCalledWith('ticket-001', mockUser.sub, expect.any(String));
      expect(result).toBeDefined();
    });
  });

  // =========================================================================
  // update()
  // =========================================================================
  describe('PATCH comments/:id', () => {
    it('doit mettre à jour un commentaire', async () => {
      commentsService.update.mockResolvedValue(updateResult);

      const result = await controller.update('comment-001', { content: 'Contenu modifié' }, mockUser);

      expect(commentsService.update).toHaveBeenCalledWith(
        'comment-001',
        mockUser.sub,
        mockUser.role,
        'Contenu modifié',
      );
      expect(result).toEqual(updateResult);
    });

    it('doit utiliser le role ADMINISTRATOR pour les admin', async () => {
      commentsService.update.mockResolvedValue(updateResult);

      await controller.update('comment-001', { content: 'Admin edit' }, mockAdmin);

      expect(commentsService.update).toHaveBeenCalledWith('comment-001', mockAdmin.sub, mockAdmin.role, 'Admin edit');
    });
  });

  // =========================================================================
  // remove()
  // =========================================================================
  describe('DELETE comments/:id', () => {
    it('doit supprimer un commentaire et retourner 204', async () => {
      commentsService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('comment-001', mockUser);

      expect(commentsService.remove).toHaveBeenCalledWith('comment-001', mockUser.sub, mockUser.role);
      expect(result).toBeUndefined();
    });

    it('doit gérer la suppression par un administrateur', async () => {
      commentsService.remove.mockResolvedValue(undefined);

      await controller.remove('comment-other', mockAdmin);

      expect(commentsService.remove).toHaveBeenCalledWith('comment-other', mockAdmin.sub, mockAdmin.role);
    });

    it('doit propager les erreurs du service (not found, forbidden)', async () => {
      commentsService.remove.mockRejectedValue(new Error('Erreur du service'));

      await expect(controller.remove('inexistant', mockUser)).rejects.toThrow('Erreur du service');
    });
  });
});
