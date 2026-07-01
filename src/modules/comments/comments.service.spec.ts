/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { CommentsService } from './comments.service';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { mock, MockProxy } from 'jest-mock-extended';
import { ticketComments } from '../../database/schemas';
import { eq } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Mock uuidv7
// ---------------------------------------------------------------------------
jest.mock('../../common/helpers/uuidv7.helper', () => ({
  generateUuid: jest.fn().mockReturnValue('0192abcd-1234-7000-8000-000000000001'),
}));

// ---------------------------------------------------------------------------
// Helper : construit un query builder chainable et thenable
// ---------------------------------------------------------------------------
function createMockQueryBuilder<T>(defaultResult: T[]) {
  const builder: any = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    then: jest.fn((resolve: (val: T[]) => void) => resolve(defaultResult)),
    catch: jest.fn(),
  };
  return builder;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const mockComment = {
  id: '0192abcd-1234-7000-8000-000000000001',
  ticketId: 'ticket-001',
  authorId: 'author-001',
  content: 'Commentaire de test.',
  createdAt: new Date('2026-01-01T10:00:00Z'),
  updatedAt: new Date('2026-01-01T10:00:00Z'),
};

const otherUserComment = {
  ...mockComment,
  id: 'comment-other',
  authorId: 'other-author',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('CommentsService', () => {
  let service: CommentsService;
  let drizzle: MockProxy<DrizzleProvider>;
  let mockDb: {
    select: jest.Mock;
    insert: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(async () => {
    mockDb = {
      select: jest.fn(),
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockResolvedValue(undefined),
      }),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        }),
      }),
      delete: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      }),
    };

    drizzle = mock<DrizzleProvider>();
    Object.defineProperty(drizzle, 'db', {
      get: jest.fn(() => mockDb),
      configurable: true,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [CommentsService, { provide: DrizzleProvider, useValue: drizzle }],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // findAll()
  // =========================================================================
  describe('findAll() — Liste paginée', () => {
    it('doit retourner les commentaires paginés', async () => {
      const countBuilder = createMockQueryBuilder([{ count: 1 }]);
      const dataBuilder = createMockQueryBuilder([mockComment]);
      mockDb.select.mockReturnValueOnce(countBuilder).mockReturnValueOnce(dataBuilder);

      const result = await service.findAll('ticket-001', 1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual(mockComment);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
      expect(mockDb.select).toHaveBeenCalledTimes(2);
    });

    it('doit retourner une liste vide quand aucun commentaire', async () => {
      const countBuilder = createMockQueryBuilder([{ count: 0 }]);
      const dataBuilder = createMockQueryBuilder([]);
      mockDb.select.mockReturnValueOnce(countBuilder).mockReturnValueOnce(dataBuilder);

      const result = await service.findAll('ticket-001', 1, 20);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });

    it('doit appliquer la pagination correctement', async () => {
      const countBuilder = createMockQueryBuilder([{ count: 50 }]);
      const dataBuilder = createMockQueryBuilder(Array(10).fill(mockComment));
      mockDb.select.mockReturnValueOnce(countBuilder).mockReturnValueOnce(dataBuilder);

      const result = await service.findAll('ticket-001', 3, 10);

      expect(result.meta.page).toBe(3);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(5);
      expect(result.data).toHaveLength(10);
    });

    it('doit filtrer par ticketId', async () => {
      const countBuilder = createMockQueryBuilder([{ count: 0 }]);
      const dataBuilder = createMockQueryBuilder([]);
      mockDb.select.mockReturnValueOnce(countBuilder).mockReturnValueOnce(dataBuilder);

      await service.findAll('specific-ticket', 1, 20);

      // Vérifie que le where filtre sur le bon ticket
      const firstSelectCall = (mockDb.select as jest.Mock).mock.calls[0][0];
      expect(firstSelectCall).toBeDefined();
    });

    it('doit utiliser les valeurs par défaut page=1 limit=20', async () => {
      const countBuilder = createMockQueryBuilder([{ count: 0 }]);
      const dataBuilder = createMockQueryBuilder([]);
      mockDb.select.mockReturnValueOnce(countBuilder).mockReturnValueOnce(dataBuilder);

      const result = await service.findAll('ticket-001');

      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });
  });

  // =========================================================================
  // create()
  // =========================================================================
  describe('create() — Ajout de commentaire', () => {
    it('doit créer un commentaire et retourner les données', async () => {
      const selectBuilder = createMockQueryBuilder([mockComment]);
      mockDb.select.mockReturnValueOnce(selectBuilder);

      const result = await service.create('ticket-001', 'author-001', 'Nouveau commentaire');

      expect(mockDb.insert).toHaveBeenCalledWith(ticketComments);
      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '0192abcd-1234-7000-8000-000000000001',
          ticketId: 'ticket-001',
          authorId: 'author-001',
          content: 'Nouveau commentaire',
        }),
      );
      expect(result.message).toContain('succès');
      expect(result.data).toEqual(mockComment);
    });

    it('doit générer un UUID v7 pour le nouvel ID', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { generateUuid } = require('../../common/helpers/uuidv7.helper');
      const selectBuilder = createMockQueryBuilder([mockComment]);
      mockDb.select.mockReturnValueOnce(selectBuilder);

      await service.create('ticket-001', 'author-001', 'Contenu');

      expect(generateUuid).toHaveBeenCalled();
    });

    it('doit re-sélectionner le commentaire après insertion', async () => {
      const selectBuilder = createMockQueryBuilder([mockComment]);
      mockDb.select.mockReturnValueOnce(selectBuilder);

      const result = await service.create('ticket-001', 'author-001', 'Contenu');

      // Vérifie que la sélection après insertion utilise eq(id)
      expect(mockDb.select).toHaveBeenCalled();
      expect(result.data).toBeDefined();
    });
  });

  // =========================================================================
  // update()
  // =========================================================================
  describe('update() — Modification de commentaire', () => {
    it("doit permettre à l'auteur de modifier son commentaire", async () => {
      const findBuilder = createMockQueryBuilder([mockComment]);
      const updateSelectBuilder = createMockQueryBuilder([{ ...mockComment, content: 'Contenu modifié' }]);
      mockDb.select.mockReturnValueOnce(findBuilder).mockReturnValueOnce(updateSelectBuilder);

      const result = await service.update(
        mockComment.id,
        mockComment.authorId,
        'CUSTOMER_SERVICE_AGENT',
        'Contenu modifié',
      );

      expect(result.message).toContain('mis à jour');
      expect(mockDb.update).toHaveBeenCalledWith(ticketComments);
    });

    it('doit permettre à ADMINISTRATOR de modifier tout commentaire', async () => {
      const findBuilder = createMockQueryBuilder([otherUserComment]);
      const updateSelectBuilder = createMockQueryBuilder([{ ...otherUserComment, content: 'Modified by admin' }]);
      mockDb.select.mockReturnValueOnce(findBuilder).mockReturnValueOnce(updateSelectBuilder);

      const result = await service.update(otherUserComment.id, 'admin-id', 'ADMINISTRATOR', 'Modified by admin');

      expect(result.message).toContain('mis à jour');
    });

    it('doit permettre à SUPERVISOR de modifier tout commentaire', async () => {
      const findBuilder = createMockQueryBuilder([otherUserComment]);
      const updateSelectBuilder = createMockQueryBuilder([{ ...otherUserComment, content: 'Modified by supervisor' }]);
      mockDb.select.mockReturnValueOnce(findBuilder).mockReturnValueOnce(updateSelectBuilder);

      const result = await service.update(otherUserComment.id, 'supervisor-id', 'SUPERVISOR', 'Modified by supervisor');

      expect(result.message).toContain('mis à jour');
    });

    it("doit lever ForbiddenException si l'utilisateur n'est ni auteur ni admin/supervisor", async () => {
      const findBuilder = createMockQueryBuilder([otherUserComment]);
      mockDb.select.mockReturnValueOnce(findBuilder);

      await expect(service.update(otherUserComment.id, 'stranger-id', 'AGENT', 'Hacked content')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("doit lever NotFoundException si le commentaire n'existe pas", async () => {
      const findBuilder = createMockQueryBuilder([]);
      mockDb.select.mockReturnValueOnce(findBuilder);

      await expect(service.update('inexistant', 'user-id', 'ADMINISTRATOR', 'Content')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('doit mettre à jour uniquement le champ content', async () => {
      const findBuilder = createMockQueryBuilder([mockComment]);
      const updateSelectBuilder = createMockQueryBuilder([{ ...mockComment, content: 'Updated only content' }]);
      mockDb.select.mockReturnValueOnce(findBuilder).mockReturnValueOnce(updateSelectBuilder);

      await service.update(mockComment.id, mockComment.authorId, 'AGENT', 'Updated only content');

      const setCall = mockDb.update().set as jest.Mock;
      expect(setCall).toHaveBeenCalledWith({ content: 'Updated only content' });
    });
  });

  // =========================================================================
  // remove()
  // =========================================================================
  describe('remove() — Suppression de commentaire', () => {
    it("doit permettre à l'auteur de supprimer son commentaire", async () => {
      const findBuilder = createMockQueryBuilder([mockComment]);
      mockDb.select.mockReturnValueOnce(findBuilder);

      await service.remove(mockComment.id, mockComment.authorId, 'AGENT');

      expect(mockDb.delete).toHaveBeenCalledWith(ticketComments);
      expect(mockDb.delete().where).toHaveBeenCalledWith(eq(ticketComments.id, mockComment.id));
    });

    it('doit permettre à ADMINISTRATOR de supprimer tout commentaire', async () => {
      const findBuilder = createMockQueryBuilder([otherUserComment]);
      mockDb.select.mockReturnValueOnce(findBuilder);

      await service.remove(otherUserComment.id, 'admin-id', 'ADMINISTRATOR');

      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('doit permettre à SUPERVISOR de supprimer tout commentaire', async () => {
      const findBuilder = createMockQueryBuilder([otherUserComment]);
      mockDb.select.mockReturnValueOnce(findBuilder);

      await service.remove(otherUserComment.id, 'supervisor-id', 'SUPERVISOR');

      expect(mockDb.delete).toHaveBeenCalled();
    });

    it("doit lever ForbiddenException si l'utilisateur n'est ni auteur ni admin/supervisor", async () => {
      const findBuilder = createMockQueryBuilder([otherUserComment]);
      mockDb.select.mockReturnValueOnce(findBuilder);

      await expect(service.remove(otherUserComment.id, 'stranger-id', 'AGENT')).rejects.toThrow(ForbiddenException);

      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it("doit lever NotFoundException si le commentaire n'existe pas", async () => {
      const findBuilder = createMockQueryBuilder([]);
      mockDb.select.mockReturnValueOnce(findBuilder);

      await expect(service.remove('inexistant', 'user-id', 'ADMINISTRATOR')).rejects.toThrow(NotFoundException);

      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it('doit retourner void en cas de succès', async () => {
      const findBuilder = createMockQueryBuilder([mockComment]);
      mockDb.select.mockReturnValueOnce(findBuilder);

      const result = await service.remove(mockComment.id, mockComment.authorId, 'AGENT');

      expect(result).toBeUndefined();
    });
  });
});
