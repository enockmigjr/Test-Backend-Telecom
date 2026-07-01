/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
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

const paginatedResult = {
  data: [
    {
      id: 'notif-001',
      userId: 'user-001',
      type: 'TICKET_ASSIGNED' as const,
      title: 'Ticket assigné',
      message: 'Le ticket TICKET-123 vous a été assigné.',
      referenceType: 'ticket',
      referenceId: 'ticket-123',
      isRead: false,
      readAt: null,
      createdAt: new Date('2026-01-01T10:00:00Z'),
    },
    {
      id: 'notif-002',
      userId: 'user-001',
      type: 'SLA_WARNING' as const,
      title: 'Alerte SLA',
      message: 'Le ticket TICKET-456 approche de la violation SLA.',
      referenceType: 'ticket',
      referenceId: 'ticket-456',
      isRead: true,
      readAt: new Date('2026-01-02T10:00:00Z'),
      createdAt: new Date('2026-01-01T09:00:00Z'),
    },
  ],
  meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
};

const unreadResult = [
  {
    id: 'notif-001',
    userId: 'user-001',
    type: 'TICKET_ASSIGNED' as const,
    title: 'Ticket assigné',
    message: 'Le ticket TICKET-123 vous a été assigné.',
    referenceType: 'ticket',
    referenceId: 'ticket-123',
    isRead: false,
    readAt: null,
    createdAt: new Date('2026-01-01T10:00:00Z'),
  },
];

const markAsReadResult = {
  message: 'Notification marquée comme lue.',
};

const markAllAsReadResult = {
  message: 'Toutes les notifications sont marquées comme lues.',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('NotificationsController', () => {
  let controller: NotificationsController;
  let notificationsService: MockProxy<NotificationsService>;

  beforeEach(async () => {
    notificationsService = mock<NotificationsService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: notificationsService }],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // findAll()
  // =========================================================================
  describe('GET /notifications', () => {
    it("doit retourner les notifications paginées de l'utilisateur connecté", async () => {
      notificationsService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(mockUser, { page: 1, limit: 20 });

      expect(notificationsService.findAll).toHaveBeenCalledWith(mockUser.sub, 1, 20);
      expect(result).toEqual(paginatedResult);
    });

    it('doit utiliser le sub du JWT comme userId', async () => {
      notificationsService.findAll.mockResolvedValue(paginatedResult);

      await controller.findAll(mockUser, { page: 1, limit: 20 });

      expect(notificationsService.findAll).toHaveBeenCalledWith(mockUser.sub, expect.any(Number), expect.any(Number));
    });

    it('doit transmettre la pagination demandée', async () => {
      notificationsService.findAll.mockResolvedValue(paginatedResult);

      await controller.findAll(mockUser, { page: 3, limit: 10 });

      expect(notificationsService.findAll).toHaveBeenCalledWith(mockUser.sub, 3, 10);
    });
  });

  // =========================================================================
  // unread()
  // =========================================================================
  describe('GET /notifications/unread', () => {
    it("doit retourner les notifications non lues de l'utilisateur connecté", async () => {
      notificationsService.getUnread.mockResolvedValue(unreadResult);

      const result = await controller.unread(mockUser);

      expect(notificationsService.getUnread).toHaveBeenCalledWith(mockUser.sub);
      expect(result).toEqual(unreadResult);
      expect(result).toHaveLength(1);
    });

    it('doit retourner un tableau vide si aucune notification non lue', async () => {
      notificationsService.getUnread.mockResolvedValue([]);

      const result = await controller.unread(mockUser);

      expect(result).toHaveLength(0);
    });
  });

  // =========================================================================
  // markRead()
  // =========================================================================
  describe('PATCH /notifications/:id/read', () => {
    it('doit marquer une notification comme lue', async () => {
      notificationsService.markAsRead.mockResolvedValue(markAsReadResult);

      const result = await controller.markRead('notif-001', mockUser);

      expect(notificationsService.markAsRead).toHaveBeenCalledWith('notif-001', mockUser.sub);
      expect(result).toEqual(markAsReadResult);
    });

    it("doit propager NotFoundException si la notification n'existe pas", async () => {
      notificationsService.markAsRead.mockRejectedValue(new Error('Notification non trouvée.'));

      await expect(controller.markRead('inexistant', mockUser)).rejects.toThrow('Notification non trouvée.');
    });

    it('doit propager NotFoundException si la notification appartient à un autre utilisateur', async () => {
      notificationsService.markAsRead.mockRejectedValue(new Error('Notification non trouvée.'));

      await expect(controller.markRead('notif-other', mockUser)).rejects.toThrow('Notification non trouvée.');
    });
  });

  // =========================================================================
  // markAllRead()
  // =========================================================================
  describe('PATCH /notifications/read-all', () => {
    it('doit marquer toutes les notifications comme lues', async () => {
      notificationsService.markAllAsRead.mockResolvedValue(markAllAsReadResult);

      const result = await controller.markAllRead(mockUser);

      expect(notificationsService.markAllAsRead).toHaveBeenCalledWith(mockUser.sub);
      expect(result).toEqual(markAllAsReadResult);
      expect(result.message).toContain('Toutes les notifications');
    });

    it('doit utiliser le sub du JWT comme userId', async () => {
      notificationsService.markAllAsRead.mockResolvedValue(markAllAsReadResult);

      await controller.markAllRead(mockUser);

      expect(notificationsService.markAllAsRead).toHaveBeenCalledWith(mockUser.sub);
    });

    it('doit fonctionner sans erreur', async () => {
      notificationsService.markAllAsRead.mockResolvedValue(markAllAsReadResult);

      const result = await controller.markAllRead(mockUser);

      expect(result).toBeDefined();
    });
  });
});
