/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { InternalNotesService } from './internal-notes.service';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { mock, MockProxy } from 'jest-mock-extended';
import { ticketInternalNotes } from '../../database/schemas';
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
    leftJoin: jest.fn().mockReturnThis(),
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
const mockNote = {
  id: '0192abcd-1234-7000-8000-000000000001',
  ticketId: 'ticket-001',
  authorId: 'author-001',
  content: 'Note interne de test.',
  createdAt: new Date('2026-01-01T10:00:00Z'),
  updatedAt: new Date('2026-01-01T10:00:00Z'),
};

const mockNoteWithAuthor = {
  id: '0192abcd-1234-7000-8000-000000000001',
  ticketId: 'ticket-001',
  authorId: 'author-001',
  content: 'Note interne de test.',
  createdAt: new Date('2026-01-01T10:00:00Z'),
  authorName: 'Admin Principal',
};

const otherUserNote = {
  ...mockNote,
  id: 'note-other',
  authorId: 'other-author',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('InternalNotesService', () => {
  let service: InternalNotesService;
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
      providers: [InternalNotesService, { provide: DrizzleProvider, useValue: drizzle }],
    }).compile();

    service = module.get<InternalNotesService>(InternalNotesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // findAll()
  // =========================================================================
  describe('findAll() — Liste paginée', () => {
    it("doit retourner les notes internes paginées avec le nom de l'auteur", async () => {
      const countBuilder = createMockQueryBuilder([{ count: 1 }]);
      const dataBuilder = createMockQueryBuilder([mockNoteWithAuthor]);
      mockDb.select.mockReturnValueOnce(countBuilder).mockReturnValueOnce(dataBuilder);

      const result = await service.findAll('ticket-001', 1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toHaveProperty('authorName', 'Admin Principal');
      expect(result.meta.page).toBe(1);
      expect(result.meta.total).toBe(1);
    });

    it('doit retourner une liste vide quand aucune note', async () => {
      const countBuilder = createMockQueryBuilder([{ count: 0 }]);
      const dataBuilder = createMockQueryBuilder([]);
      mockDb.select.mockReturnValueOnce(countBuilder).mockReturnValueOnce(dataBuilder);

      const result = await service.findAll('ticket-001', 1, 20);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });

    it('doit appliquer la pagination', async () => {
      const countBuilder = createMockQueryBuilder([{ count: 25 }]);
      const dataBuilder = createMockQueryBuilder(Array(5).fill(mockNoteWithAuthor));
      mockDb.select.mockReturnValueOnce(countBuilder).mockReturnValueOnce(dataBuilder);

      const result = await service.findAll('ticket-001', 2, 5);

      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(5);
      expect(result.meta.totalPages).toBe(5);
      expect(result.data).toHaveLength(5);
    });

    it('doit faire un leftJoin avec la table users', async () => {
      const countBuilder = createMockQueryBuilder([{ count: 0 }]);
      const dataBuilder = createMockQueryBuilder([]);
      mockDb.select.mockReturnValueOnce(countBuilder).mockReturnValueOnce(dataBuilder);

      await service.findAll('ticket-001', 1, 20);

      // Vérifie que leftJoin a été appelé sur le data builder
      const dataSelectCall = (mockDb.select as jest.Mock).mock.results[1].value;
      expect(dataSelectCall.leftJoin).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // create()
  // =========================================================================
  describe('create() — Ajout de note interne', () => {
    it('doit créer une note interne pour un rôle autorisé', async () => {
      const selectBuilder = createMockQueryBuilder([mockNote]);
      mockDb.select.mockReturnValueOnce(selectBuilder);

      const result = await service.create('ticket-001', 'author-001', 'Nouvelle note', 'AGENT');

      expect(mockDb.insert).toHaveBeenCalledWith(ticketInternalNotes);
      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '0192abcd-1234-7000-8000-000000000001',
          ticketId: 'ticket-001',
          authorId: 'author-001',
          content: 'Nouvelle note',
        }),
      );
      expect(result.message).toContain('Note interne');
      expect(result.data).toEqual(mockNote);
    });

    it('doit lever ForbiddenException pour FIELD_TECHNICIAN', async () => {
      await expect(service.create('ticket-001', 'field-tech-id', 'Note interdite', 'FIELD_TECHNICIAN')).rejects.toThrow(
        ForbiddenException,
      );

      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('doit lever ForbiddenException avec le message approprié', async () => {
      await expect(service.create('ticket-001', 'field-tech-id', 'Note', 'FIELD_TECHNICIAN')).rejects.toThrow(
        'Les techniciens terrain ne peuvent pas créer de notes internes.',
      );
    });

    it('doit autoriser NOC_ENGINEER à créer des notes', async () => {
      const selectBuilder = createMockQueryBuilder([mockNote]);
      mockDb.select.mockReturnValueOnce(selectBuilder);

      const result = await service.create('ticket-001', 'noc-id', 'Note NOC', 'NOC_ENGINEER');

      expect(result).toBeDefined();
      expect(result.data).toEqual(mockNote);
    });

    it('doit autoriser ADMINISTRATOR à créer des notes', async () => {
      const selectBuilder = createMockQueryBuilder([mockNote]);
      mockDb.select.mockReturnValueOnce(selectBuilder);

      const result = await service.create('ticket-001', 'admin-id', 'Note admin', 'ADMINISTRATOR');

      expect(result).toBeDefined();
    });
  });

  // =========================================================================
  // update()
  // =========================================================================
  describe('update() — Modification de note interne', () => {
    it("doit permettre à l'auteur de modifier sa note", async () => {
      const findBuilder = createMockQueryBuilder([mockNote]);
      mockDb.select.mockReturnValueOnce(findBuilder);

      const result = await service.update(mockNote.id, mockNote.authorId, 'AGENT', 'Contenu modifié');

      expect(result.message).toContain('mise à jour');
      expect(mockDb.update).toHaveBeenCalledWith(ticketInternalNotes);
    });

    it('doit permettre à ADMINISTRATOR de modifier toute note', async () => {
      const findBuilder = createMockQueryBuilder([otherUserNote]);
      mockDb.select.mockReturnValueOnce(findBuilder);

      const result = await service.update(otherUserNote.id, 'admin-id', 'ADMINISTRATOR', 'Admin edit');

      expect(result.message).toContain('mise à jour');
    });

    it('doit permettre à SUPERVISOR de modifier toute note', async () => {
      const findBuilder = createMockQueryBuilder([otherUserNote]);
      mockDb.select.mockReturnValueOnce(findBuilder);

      const result = await service.update(otherUserNote.id, 'supervisor-id', 'SUPERVISOR', 'Supervisor edit');

      expect(result.message).toContain('mise à jour');
    });

    it('doit lever ForbiddenException pour FIELD_TECHNICIAN', async () => {
      await expect(service.update('note-id', 'field-tech-id', 'FIELD_TECHNICIAN', 'Hack')).rejects.toThrow(
        ForbiddenException,
      );

      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('doit lever ForbiddenException si pas auteur ni admin/supervisor', async () => {
      const findBuilder = createMockQueryBuilder([otherUserNote]);
      mockDb.select.mockReturnValueOnce(findBuilder);

      await expect(service.update(otherUserNote.id, 'stranger-id', 'AGENT', 'Hack')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("doit lever NotFoundException si la note n'existe pas", async () => {
      const findBuilder = createMockQueryBuilder([]);
      mockDb.select.mockReturnValueOnce(findBuilder);

      await expect(service.update('inexistant', 'user-id', 'ADMINISTRATOR', 'Content')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =========================================================================
  // remove()
  // =========================================================================
  describe('remove() — Suppression de note interne', () => {
    it("doit permettre à l'auteur de supprimer sa note", async () => {
      const findBuilder = createMockQueryBuilder([mockNote]);
      mockDb.select.mockReturnValueOnce(findBuilder);

      await service.remove(mockNote.id, mockNote.authorId, 'AGENT');

      expect(mockDb.delete).toHaveBeenCalledWith(ticketInternalNotes);
      expect(mockDb.delete().where).toHaveBeenCalledWith(eq(ticketInternalNotes.id, mockNote.id));
    });

    it('doit permettre à ADMINISTRATOR de supprimer toute note', async () => {
      const findBuilder = createMockQueryBuilder([otherUserNote]);
      mockDb.select.mockReturnValueOnce(findBuilder);

      await service.remove(otherUserNote.id, 'admin-id', 'ADMINISTRATOR');

      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('doit lever ForbiddenException pour FIELD_TECHNICIAN', async () => {
      await expect(service.remove('note-id', 'field-tech-id', 'FIELD_TECHNICIAN')).rejects.toThrow(ForbiddenException);

      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it('doit lever ForbiddenException si pas auteur ni admin/supervisor', async () => {
      const findBuilder = createMockQueryBuilder([otherUserNote]);
      mockDb.select.mockReturnValueOnce(findBuilder);

      await expect(service.remove(otherUserNote.id, 'stranger-id', 'AGENT')).rejects.toThrow(ForbiddenException);

      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it("doit lever NotFoundException si la note n'existe pas", async () => {
      const findBuilder = createMockQueryBuilder([]);
      mockDb.select.mockReturnValueOnce(findBuilder);

      await expect(service.remove('inexistant', 'user-id', 'ADMINISTRATOR')).rejects.toThrow(NotFoundException);

      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it('doit retourner void en cas de succès', async () => {
      const findBuilder = createMockQueryBuilder([mockNote]);
      mockDb.select.mockReturnValueOnce(findBuilder);

      const result = await service.remove(mockNote.id, mockNote.authorId, 'AGENT');

      expect(result).toBeUndefined();
    });
  });
});
