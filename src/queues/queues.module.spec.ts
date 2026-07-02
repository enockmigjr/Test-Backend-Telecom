/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QueuesModule, EMAIL_QUEUE, NOTIFICATION_QUEUE, SLA_QUEUE, AUDIT_QUEUE, REPORT_QUEUE } from './queues.module';
import { EmailWorker } from './workers/email.worker';
import { NotificationWorker } from './workers/notification.worker';
import { SlaWorker } from './workers/sla.worker';
import { AuditWorker } from './workers/audit.worker';
import { ReportWorker } from './workers/report.worker';
import { EmailService } from '../modules/email/email.service';
import { DrizzleProvider } from '../database/drizzle.provider';
import { TelecomWebSocketGateway } from '../websocket/websocket.gateway';

// ─── BullMQ mock (hoisted by jest) ───────────────────────────────────────────
const mockWorkerOn = jest.fn();
const mockWorkerClose = jest.fn().mockResolvedValue(undefined);

jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation(() => ({
    on: mockWorkerOn,
    close: mockWorkerClose,
  })),
  Queue: jest.fn().mockImplementation((name: string) => ({
    name,
    add: jest.fn().mockResolvedValue(undefined),
  })),
}));

// ─── Mocks des dépendances externes ──────────────────────────────────────────
const mockEmailService = {};
const mockDrizzle = {
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
  },
};
const mockWsGateway = {
  isUserConnected: jest.fn(),
  emitToUser: jest.fn(),
};

describe('QueuesModule', () => {
  let moduleRef: TestingModule;
  let loggerLogSpy: jest.SpyInstance;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [QueuesModule],
    })
      .useMocker((token) => {
        if (token === EmailService) return mockEmailService;
        if (token === DrizzleProvider) return mockDrizzle;
        if (token === TelecomWebSocketGateway) return mockWsGateway;
        if (typeof token === 'function') return {};
        return {};
      })
      .compile();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    loggerLogSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── Constantes de files ───────────────────────────────────────────────────

  describe('constantes de noms de files', () => {
    it('doit exporter EMAIL_QUEUE', () => {
      expect(EMAIL_QUEUE).toBe('email-queue');
    });

    it('doit exporter NOTIFICATION_QUEUE', () => {
      expect(NOTIFICATION_QUEUE).toBe('notification-queue');
    });

    it('doit exporter SLA_QUEUE', () => {
      expect(SLA_QUEUE).toBe('sla-queue');
    });

    it('doit exporter AUDIT_QUEUE', () => {
      expect(AUDIT_QUEUE).toBe('audit-queue');
    });

    it('doit exporter REPORT_QUEUE', () => {
      expect(REPORT_QUEUE).toBe('report-queue');
    });
  });

  // ─── Résolution des providers ──────────────────────────────────────────────

  describe('résolution des workers', () => {
    it('doit résoudre EmailWorker', () => {
      const emailWorker = moduleRef.get<EmailWorker>(EmailWorker);
      expect(emailWorker).toBeDefined();
      expect(emailWorker).toBeInstanceOf(EmailWorker);
    });

    it('doit résoudre NotificationWorker', () => {
      const notificationWorker = moduleRef.get<NotificationWorker>(NotificationWorker);
      expect(notificationWorker).toBeDefined();
      expect(notificationWorker).toBeInstanceOf(NotificationWorker);
    });

    it('doit résoudre SlaWorker', () => {
      const slaWorker = moduleRef.get<SlaWorker>(SlaWorker);
      expect(slaWorker).toBeDefined();
      expect(slaWorker).toBeInstanceOf(SlaWorker);
    });

    it('doit résoudre AuditWorker', () => {
      const auditWorker = moduleRef.get<AuditWorker>(AuditWorker);
      expect(auditWorker).toBeDefined();
      expect(auditWorker).toBeInstanceOf(AuditWorker);
    });

    it('doit résoudre ReportWorker', () => {
      const reportWorker = moduleRef.get<ReportWorker>(ReportWorker);
      expect(reportWorker).toBeDefined();
      expect(reportWorker).toBeInstanceOf(ReportWorker);
    });
  });

  // ─── Injection token BullMQ_Queues ────────────────────────────────────────

  describe('BullMQ_Queues', () => {
    it('doit résoudre le token BullMQ_Queues avec 5 queues', () => {
      const queues = moduleRef.get<Record<string, Queue>>('BullMQ_Queues');
      expect(queues).toBeDefined();
      expect(queues.email).toBeDefined();
      expect(queues.notification).toBeDefined();
      expect(queues.sla).toBeDefined();
      expect(queues.audit).toBeDefined();
      expect(queues.report).toBeDefined();
    });
  });

  // ─── Injection des dépendances ─────────────────────────────────────────────

  describe('injection des dépendances', () => {
    it('EmailWorker reçoit EmailService', () => {
      const emailWorker = moduleRef.get<EmailWorker>(EmailWorker);
      expect((emailWorker as any).emailService).toBe(mockEmailService);
    });

    it('NotificationWorker reçoit DrizzleProvider et WebSocketGateway', () => {
      const notifWorker = moduleRef.get<NotificationWorker>(NotificationWorker);
      expect((notifWorker as any).drizzle).toBe(mockDrizzle);
      expect((notifWorker as any).wsGateway).toBe(mockWsGateway);
    });

    it('SlaWorker reçoit DrizzleProvider', () => {
      const slaWorker = moduleRef.get<SlaWorker>(SlaWorker);
      expect((slaWorker as any).drizzle).toBe(mockDrizzle);
    });

    it('AuditWorker reçoit DrizzleProvider', () => {
      const auditWorker = moduleRef.get<AuditWorker>(AuditWorker);
      expect((auditWorker as any).drizzle).toBe(mockDrizzle);
    });

    it('ReportWorker reçoit DrizzleProvider et BullMQ_Queues', () => {
      const reportWorker = moduleRef.get<ReportWorker>(ReportWorker);
      expect((reportWorker as any).drizzle).toBe(mockDrizzle);
      expect((reportWorker as any).queues).toBeDefined();
    });
  });

  // ─── Cycle de vie ──────────────────────────────────────────────────────────

  describe('onModuleInit', () => {
    it("doit logger l'initialisation des 5 workers", () => {
      const queuesModule = moduleRef.get<QueuesModule>(QueuesModule);
      queuesModule.onModuleInit();

      expect(loggerLogSpy).toHaveBeenCalledWith(expect.stringContaining('5 Workers'));
    });
  });
});
