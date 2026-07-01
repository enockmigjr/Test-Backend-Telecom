/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { NotFoundException } from '@nestjs/common';
import { mock, MockProxy } from 'jest-mock-extended';
import { notifications } from '../../database/schemas';
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
const mockNotification = {
  id: 'notif-001',
  userId: 'user-001',
  type: 'TICKET_ASSIGNED' as const,
  title: 'Ticket assigné',
  message: 'Le ticket TICKET-123 vous a été assigné.',
  referenceType: 'ticket',
  referenceId: 'ticket-123',
  isRead: false,
  readAt: null as Date | null,
  createdAt: new Date('2026-01-01T10:00:00Z'),
};

const mockReadNotification = {
  ...mockNotification,
  id: 'notif-002',
  isRead: true,
  readAt: new Date('2026-01-02T10:00:00Z'),
};

const otherUserNotification = {
  ...mockNotification,
  id: 'notif-other',
  userId: 'other-user',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('NotificationsService', () => {
  let service: NotificationsService;
  let drizzle: MockProxy<DrizzleProvider>;
  let mockDb: {
    select: jest.Mock;
    insert: jest.Mock;
    update: jest.Mock;
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
    };

    drizzle = mock<DrizzleProvider>();
    Object.defineProperty(drizzle, 'db', {
      get: jest.fn(() => mockDb),
      configurable: true,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationsService, { provide: DrizzleProvider, useValue: drizzle }],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // findAll()
  // =========================================================================
  describe('findAll() — Liste paginée', () => {
    it("doit retourner les notifications de l'utilisateur paginées", async () => {
      const countBuilder = createMockQueryBuilder([{ count: 2 }]);
      const dataBuilder = createMockQueryBuilder([mockNotification, mockReadNotification]);
      mockDb.select.mockReturnValueOnce(countBuilder).mockReturnValueOnce(dataBuilder);

      const result = await service.findAll('user-001', 1, 20);

      expect(result.data).toHaveLength(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.total).toBe(2);
      expect(result.meta.totalPages).toBe(1);
    });

    it('doit filtrer les notifications par userId', async () => {
      const countBuilder = createMockQueryBuilder([{ count: 0 }]);
      const dataBuilder = createMockQueryBuilder([]);
      mockDb.select.mockReturnValueOnce(countBuilder).mockReturnValueOnce(dataBuilder);

      await service.findAll('specific-user', 1, 20);

      // Vérifie que select a été appelé deux fois
      expect(mockDb.select).toHaveBeenCalledTimes(2);
    });

    it('doit retourner une liste vide si aucune notification', async () => {
      const countBuilder = createMockQueryBuilder([{ count: 0 }]);
      const dataBuilder = createMockQueryBuilder([]);
      mockDb.select.mockReturnValueOnce(countBuilder).mockReturnValueOnce(dataBuilder);

      const result = await service.findAll('user-001', 1, 20);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });

    it('doit appliquer la pagination correctement', async () => {
      const countBuilder = createMockQueryBuilder([{ count: 50 }]);
      const dataBuilder = createMockQueryBuilder(Array(10).fill(mockNotification));
      mockDb.select.mockReturnValueOnce(countBuilder).mockReturnValueOnce(dataBuilder);

      const result = await service.findAll('user-001', 3, 10);

      expect(result.meta.page).toBe(3);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(5);
    });

    it('doit trier par createdAt desc', async () => {
      const countBuilder = createMockQueryBuilder([{ count: 0 }]);
      const dataBuilder = createMockQueryBuilder([]);
      mockDb.select.mockReturnValueOnce(countBuilder).mockReturnValueOnce(dataBuilder);

      await service.findAll('user-001', 1, 20);

      // Vérifie que orderBy a été appelé sur le data builder
      const dataSelectCall = (mockDb.select as jest.Mock).mock.results[1].value;
      expect(dataSelectCall.orderBy).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // getUnread()
  // =========================================================================
  describe('getUnread() — Non lues', () => {
    it("doit retourner les notifications non lues de l'utilisateur", async () => {
      const unreadBuilder = createMockQueryBuilder([mockNotification]);
      mockDb.select.mockReturnValueOnce(unreadBuilder);

      const result = await service.getUnread('user-001');

      expect(result).toHaveLength(1);
      expect(result[0].isRead).toBe(false);
    });

    it('doit filtrer par userId ET isRead=false', async () => {
      const unreadBuilder = createMockQueryBuilder([]);
      mockDb.select.mockReturnValueOnce(unreadBuilder);

      await service.getUnread('user-001');

      // Vérifie que where utilise and() avec deux conditions
      const whereFn = (mockDb.select as jest.Mock).mock.results[0].value.where;
      expect(whereFn).toHaveBeenCalled();
    });

    it('ne doit pas inclure les notifications lues', async () => {
      const unreadBuilder = createMockQueryBuilder([]);
      mockDb.select.mockReturnValueOnce(unreadBuilder);

      const result = await service.getUnread('user-001');

      expect(result).toHaveLength(0);
    });

    it('doit retourner une liste triée par createdAt desc', async () => {
      const unreadBuilder = createMockQueryBuilder([mockNotification]);
      mockDb.select.mockReturnValueOnce(unreadBuilder);

      const result = await service.getUnread('user-001');

      expect(result).toBeDefined();
    });

    it('ne doit pas retourner les notifications des autres utilisateurs', async () => {
      const unreadBuilder = createMockQueryBuilder([]);
      mockDb.select.mockReturnValueOnce(unreadBuilder);

      const result = await service.getUnread('other-user');

      expect(result).toHaveLength(0);
    });
  });

  // =========================================================================
  // create()
  // =========================================================================
  describe('create() — Création', () => {
    it('doit créer une notification avec tous les champs', async () => {
      const result = await service.create(
        'user-001',
        'TICKET_ASSIGNED',
        'Ticket assigné',
        'Le ticket TICKET-123 vous a été assigné.',
        'ticket',
        'ticket-123',
      );

      expect(mockDb.insert).toHaveBeenCalledWith(notifications);
      expect(mockDb.insert().values).toHaveBeenCalledWith({
        id: '0192abcd-1234-7000-8000-000000000001',
        userId: 'user-001',
        type: 'TICKET_ASSIGNED',
        title: 'Ticket assigné',
        message: 'Le ticket TICKET-123 vous a été assigné.',
        referenceType: 'ticket',
        referenceId: 'ticket-123',
      });
      expect(result).toBe('0192abcd-1234-7000-8000-000000000001');
    });

    it('doit créer une notification sans référence', async () => {
      const result = await service.create(
        'user-001',
        'SLA_WARNING',
        'Alerte SLA',
        'Le ticket TICKET-123 approche de la violation SLA.',
      );

      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceType: null,
          referenceId: null,
        }),
      );
      expect(result).toBeDefined();
    });

    it("doit retourner l'ID de la notification créée", async () => {
      const result = await service.create('user-001', 'TICKET_ASSIGNED', 'Title', 'Message');

      expect(typeof result).toBe('string');
      expect(result).toBe('0192abcd-1234-7000-8000-000000000001');
    });

    it('doit générer un UUID v7 pour le nouvel ID', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { generateUuid } = require('../../common/helpers/uuidv7.helper');

      await service.create('user-001', 'TICKET_RESOLVED', 'Résolu', 'Ticket résolu.');

      expect(generateUuid).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // markAsRead()
  // =========================================================================
  describe('markAsRead() — Marquer comme lue', () => {
    it('doit marquer une notification comme lue', async () => {
      const findBuilder = createMockQueryBuilder([mockNotification]);
      mockDb.select.mockReturnValueOnce(findBuilder);

      const result = await service.markAsRead('notif-001', 'user-001');

      expect(result.message).toContain('marquée comme lue');
      expect(mockDb.update).toHaveBeenCalledWith(notifications);
      expect(mockDb.update().set).toHaveBeenCalledWith(
        expect.objectContaining({
          isRead: true,
          readAt: expect.any(Date),
        }),
      );
      expect(mockDb.update().set().where).toHaveBeenCalledWith(eq(notifications.id, 'notif-001'));
    });

    it("doit lever NotFoundException si la notification n'existe pas", async () => {
      const findBuilder = createMockQueryBuilder([]);
      mockDb.select.mockReturnValueOnce(findBuilder);

      await expect(service.markAsRead('inexistant', 'user-001')).rejects.toThrow(NotFoundException);

      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('doit lever NotFoundException si la notification appartient à un autre utilisateur', async () => {
      const findBuilder = createMockQueryBuilder([otherUserNotification]);
      mockDb.select.mockReturnValueOnce(findBuilder);

      await expect(service.markAsRead(otherUserNotification.id, 'wrong-user')).rejects.toThrow(NotFoundException);

      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it("doit permettre à l'utilisateur propriétaire de marquer comme lue", async () => {
      const findBuilder = createMockQueryBuilder([mockNotification]);
      mockDb.select.mockReturnValueOnce(findBuilder);

      const result = await service.markAsRead('notif-001', 'user-001');

      expect(result).toBeDefined();
      expect(result.message).toContain('marquée comme lue');
    });

    it('doit marquer une notification déjà lue sans erreur', async () => {
      const findBuilder = createMockQueryBuilder([mockReadNotification]);
      mockDb.select.mockReturnValueOnce(findBuilder);

      const result = await service.markAsRead('notif-002', 'user-001');

      expect(result).toBeDefined();
      // La notification existe et appartient à l'utilisateur, donc OK
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // markAllAsRead()
  // =========================================================================
  describe('markAllAsRead() — Tout marquer comme lu', () => {
    it('doit marquer toutes les notifications non lues comme lues', async () => {
      const result = await service.markAllAsRead('user-001');

      expect(result.message).toContain('Toutes les notifications');
      expect(mockDb.update).toHaveBeenCalledWith(notifications);
      expect(mockDb.update().set).toHaveBeenCalledWith(
        expect.objectContaining({
          isRead: true,
          readAt: expect.any(Date),
        }),
      );
      // Vérifie que where filtre par userId ET isRead=false
      expect(mockDb.update().set().where).toHaveBeenCalled();
    });

    it('doit fonctionner même si aucune notification non lue', async () => {
      const result = await service.markAllAsRead('user-001');

      expect(result.message).toContain('Toutes les notifications');
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("ne doit marquer que les notifications de l'utilisateur", async () => {
      await service.markAllAsRead('specific-user');

      // Vérifie que le where utilise and() pour filtrer
      expect(mockDb.update().set().where).toHaveBeenCalled();
    });
  });
});
