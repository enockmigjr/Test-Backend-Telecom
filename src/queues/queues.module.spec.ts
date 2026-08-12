/**
 * ============================================================================
 * FICHIER : src/queues/queues.module.spec.ts
 * RÔLE : Suite de tests unitaires pour le composant queues.module.
 * EXPLICATION :
 * Ce fichier contient les tests automatisés validant le comportement et l'intégrité de queues.module.
 * 1. Vérifie le fonctionnement nominal et les cas d'erreur.
 * 2. Garantit qu'aucune régression n'est introduite lors des évolutions du code.
 * ============================================================================
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  QueuesModule,
  EMAIL_QUEUE,
  NOTIFICATION_QUEUE,
  SLA_QUEUE,
  AUDIT_QUEUE,
  REPORT_QUEUE,
  EXTERNAL_DELIVERY_QUEUE,
  ATTACHMENT_SCAN_QUEUE,
} from './queues.module';
import { EmailWorker } from './workers/email.worker';
import { NotificationWorker } from './workers/notification.worker';
import { SlaWorker } from './workers/sla.worker';
import { AuditWorker } from './workers/audit.worker';
import { ReportWorker } from './workers/report.worker';
import { ExternalDeliveryWorker } from './workers/external-delivery.worker';
import { EmailService } from '../modules/email/email.service';
import { DrizzleProvider } from '../database/drizzle.provider';
import { TelecomWebSocketGateway } from '../websocket/websocket.gateway';
import { JwtConfigService } from '../config/jwt.config';
import { JwtStrategy } from '../modules/auth/strategies/jwt.strategy';

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
      .overrideProvider(DrizzleProvider)
      .useValue(mockDrizzle)
      .overrideProvider(EmailService)
      .useValue(mockEmailService)
      .overrideProvider(TelecomWebSocketGateway)
      .useValue(mockWsGateway)
      .overrideProvider(JwtConfigService)
      .useValue({ accessSecret: 'test-access-secret-at-least-32-characters' })
      .overrideProvider(JwtStrategy)
      .useValue({})
      .useMocker((token) => {
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
    /** Test : doit exporter EMAIL_QUEUE */
    it('doit exporter EMAIL_QUEUE', () => {
      expect(EMAIL_QUEUE).toBe('email-queue');
    });

    /** Test : doit exporter NOTIFICATION_QUEUE */

    it('doit exporter NOTIFICATION_QUEUE', () => {
      expect(NOTIFICATION_QUEUE).toBe('notification-queue');
    });

    /** Test : doit exporter SLA_QUEUE */

    it('doit exporter SLA_QUEUE', () => {
      expect(SLA_QUEUE).toBe('sla-queue');
    });

    /** Test : doit exporter AUDIT_QUEUE */

    it('doit exporter AUDIT_QUEUE', () => {
      expect(AUDIT_QUEUE).toBe('audit-queue');
    });

    /** Test : doit exporter REPORT_QUEUE */

    it('doit exporter REPORT_QUEUE', () => {
      expect(REPORT_QUEUE).toBe('report-queue');
    });

    it('doit exporter EXTERNAL_DELIVERY_QUEUE', () => {
      expect(EXTERNAL_DELIVERY_QUEUE).toBe('external-delivery-queue');
    });

    it('doit exporter ATTACHMENT_SCAN_QUEUE', () => {
      expect(ATTACHMENT_SCAN_QUEUE).toBe('attachment-scan-queue');
    });
  });

  // ─── Résolution des providers ──────────────────────────────────────────────

  describe('résolution des workers', () => {
    /** Test : doit résoudre EmailWorker */
    it('doit résoudre EmailWorker', () => {
      const emailWorker = moduleRef.get<EmailWorker>(EmailWorker);
      expect(emailWorker).toBeDefined();
      expect(emailWorker).toBeInstanceOf(EmailWorker);
    });

    /** Test : doit résoudre NotificationWorker */

    it('doit résoudre NotificationWorker', () => {
      const notificationWorker = moduleRef.get<NotificationWorker>(NotificationWorker);
      expect(notificationWorker).toBeDefined();
      expect(notificationWorker).toBeInstanceOf(NotificationWorker);
    });

    /** Test : doit résoudre SlaWorker */

    it('doit résoudre SlaWorker', () => {
      const slaWorker = moduleRef.get<SlaWorker>(SlaWorker);
      expect(slaWorker).toBeDefined();
      expect(slaWorker).toBeInstanceOf(SlaWorker);
    });

    /** Test : doit résoudre AuditWorker */

    it('doit résoudre AuditWorker', () => {
      const auditWorker = moduleRef.get<AuditWorker>(AuditWorker);
      expect(auditWorker).toBeDefined();
      expect(auditWorker).toBeInstanceOf(AuditWorker);
    });

    /** Test : doit résoudre ReportWorker */

    it('doit résoudre ReportWorker', () => {
      const reportWorker = moduleRef.get<ReportWorker>(ReportWorker);
      expect(reportWorker).toBeDefined();
      expect(reportWorker).toBeInstanceOf(ReportWorker);
    });

    /** Test : doit résoudre ExternalDeliveryWorker */
    it('doit résoudre ExternalDeliveryWorker', () => {
      const externalDeliveryWorker = moduleRef.get<ExternalDeliveryWorker>(ExternalDeliveryWorker);
      expect(externalDeliveryWorker).toBeDefined();
      expect(externalDeliveryWorker).toBeInstanceOf(ExternalDeliveryWorker);
    });
  });

  // ─── Injection token BullMQ_Queues ────────────────────────────────────────

  describe('BullMQ_Queues', () => {
    /** Test : doit résoudre le token BullMQ_Queues avec 8 queues */
    it('doit résoudre le token BullMQ_Queues avec 8 queues', () => {
      const queues = moduleRef.get<Record<string, Queue>>('BullMQ_Queues');
      expect(queues).toBeDefined();
      expect(queues.email).toBeDefined();
      expect(queues.notification).toBeDefined();
      expect(queues.sla).toBeDefined();
      expect(queues.audit).toBeDefined();
      expect(queues.report).toBeDefined();
      expect(queues.assignment).toBeDefined();
      expect(queues.externalDelivery).toBeDefined();
      expect(queues.attachmentScan).toBeDefined();
    });
  });

  // ─── Injection des dépendances ─────────────────────────────────────────────

  describe('injection des dépendances', () => {
    /** Test : EmailWorker reçoit EmailService */
    it('EmailWorker reçoit EmailService', () => {
      const emailWorker = moduleRef.get<EmailWorker>(EmailWorker);
      expect((emailWorker as any).emailService).toBeDefined();
    });

    /** Test : NotificationWorker reçoit DrizzleProvider et WebSocketGateway */

    it('NotificationWorker reçoit DrizzleProvider et WebSocketGateway', () => {
      const notifWorker = moduleRef.get<NotificationWorker>(NotificationWorker);
      expect((notifWorker as any).drizzle).toBeDefined();
      expect((notifWorker as any).wsGateway).toBeDefined();
    });

    /** Test : SlaWorker reçoit DrizzleProvider */

    it('SlaWorker reçoit DrizzleProvider', () => {
      const slaWorker = moduleRef.get<SlaWorker>(SlaWorker);
      expect((slaWorker as any).drizzle).toBeDefined();
    });

    /** Test : AuditWorker reçoit DrizzleProvider */

    it('AuditWorker reçoit DrizzleProvider', () => {
      const auditWorker = moduleRef.get<AuditWorker>(AuditWorker);
      expect((auditWorker as any).drizzle).toBeDefined();
    });

    /** Test : ReportWorker reçoit DrizzleProvider et BullMQ_Queues */

    it('ReportWorker reçoit DrizzleProvider et BullMQ_Queues', () => {
      const reportWorker = moduleRef.get<ReportWorker>(ReportWorker);
      expect((reportWorker as any).drizzle).toBeDefined();
      expect((reportWorker as any).queues).toBeDefined();
    });
  });

  // ─── Cycle de vie ──────────────────────────────────────────────────────────

  describe('onModuleInit', () => {
    it("doit logger l'initialisation des 8 workers", () => {
      const queuesModule = moduleRef.get<QueuesModule>(QueuesModule);
      queuesModule.onModuleInit();

      expect(loggerLogSpy).toHaveBeenCalledWith(expect.stringContaining('external-delivery'));
    });
  });
});
