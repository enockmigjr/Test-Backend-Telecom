import { mock, MockProxy } from 'jest-mock-extended';

import { DrizzleProvider } from '../../../database/drizzle.provider';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { KeycloakAdminService } from './keycloak-admin.service';
import { KeycloakEventsService } from './keycloak-events.service';

const keycloakEvent = {
  id: 'event-001',
  userId: 'kc-subject-1',
  type: 'LOGIN',
  ipAddress: '127.0.0.1',
  clientId: 'telecom-frontend',
  details: { auth_method: 'openid-connect' },
};

function drizzleWithUser() {
  const limit = jest.fn().mockResolvedValue([{ id: 'user-001' }]);
  return {
    db: { select: jest.fn(() => ({ from: jest.fn(() => ({ where: jest.fn(() => ({ limit })) })) })) },
  } as unknown as DrizzleProvider;
}

describe('KeycloakEventsService', () => {
  const originalEnv = process.env;
  let keycloakAdmin: MockProxy<KeycloakAdminService>;
  let auditLogs: MockProxy<AuditLogsService>;
  let service: KeycloakEventsService;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env['KEYCLOAK_EVENTS_SYNC_CRON'];
    keycloakAdmin = mock<KeycloakAdminService>();
    auditLogs = mock<AuditLogsService>();
    service = new KeycloakEventsService(keycloakAdmin, auditLogs, drizzleWithUser());
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('insère les événements mappables vers audit_logs avec source_event_id', async () => {
    keycloakAdmin.listEvents.mockResolvedValue([keycloakEvent]);

    await service.sync();

    expect(auditLogs.createByActor).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SYSTEM' }),
      'KEYCLOAK_LOGIN',
      'user',
      'user-001',
      undefined,
      { clientId: 'telecom-frontend', details: { auth_method: 'openid-connect' } },
      '127.0.0.1',
      undefined,
      undefined,
      'event-001',
    );
  });

  it('ignore les événements sans sujet mappable', async () => {
    const limit = jest.fn().mockResolvedValue([]);
    const drizzle = {
      db: { select: jest.fn(() => ({ from: jest.fn(() => ({ where: jest.fn(() => ({ limit })) })) })) },
    } as unknown as DrizzleProvider;
    service = new KeycloakEventsService(keycloakAdmin, auditLogs, drizzle);
    keycloakAdmin.listEvents.mockResolvedValue([keycloakEvent]);

    await service.sync();

    expect(auditLogs.createByActor).not.toHaveBeenCalled();
  });

  it('ne duplique pas les événements déjà synchronisés (source_event_id unique)', async () => {
    keycloakAdmin.listEvents.mockResolvedValue([keycloakEvent]);
    auditLogs.createByActor.mockRejectedValue(new Error('duplicate key value violates unique constraint'));

    await expect(service.sync()).resolves.toBeUndefined();
  });

  it('est désactivable via KEYCLOAK_EVENTS_SYNC_CRON=disabled', async () => {
    process.env['KEYCLOAK_EVENTS_SYNC_CRON'] = 'disabled';

    await service.sync();

    expect(keycloakAdmin.listEvents).not.toHaveBeenCalled();
  });
});
