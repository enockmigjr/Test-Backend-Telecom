import { mock, MockProxy } from 'jest-mock-extended';
import { Socket } from 'socket.io';
import { DrizzleProvider } from '../database/drizzle.provider';
import { PublicWebSocketAuthService } from './public-websocket-auth.service';
import { PublicSupportGateway } from './public-support.gateway';

function conversationQuery(rows: readonly { id: string; ticketId: string | null }[]) {
  const limit = jest.fn().mockResolvedValue(rows);
  const orderBy = jest.fn(() => ({ limit }));
  const where = jest.fn(() => ({ orderBy }));
  const from = jest.fn(() => ({ where }));
  return { select: jest.fn(() => ({ from })), where, limit };
}

function drizzleWithSelect(select: jest.Mock): DrizzleProvider {
  const drizzle = Object.create(DrizzleProvider.prototype) as DrizzleProvider;
  Object.defineProperty(drizzle, 'db', { value: { select } });
  return drizzle;
}

describe('PublicSupportGateway', () => {
  let auth: MockProxy<PublicWebSocketAuthService>;
  let client: MockProxy<Socket>;

  beforeEach(() => {
    auth = mock<PublicWebSocketAuthService>();
    client = mock<Socket>();
    Object.defineProperty(client, 'id', { value: 'socket-001' });
    Object.defineProperty(client, 'handshake', {
      value: { headers: { cookie: 'support_session=token', origin: 'https://widget.example.test' } },
    });
  });

  it('rejoint uniquement les rooms du demandeur authentifie et de ses conversations', async () => {
    auth.authenticate.mockResolvedValue({
      kind: 'PUBLIC',
      sub: 'requester-001',
      externalRequesterId: 'requester-001',
      supportIntegrationId: 'integration-001',
      jti: 'session-001',
    });
    const query = conversationQuery([
      { id: 'conversation-001', ticketId: 'ticket-001' },
      { id: 'conversation-002', ticketId: null },
    ]);
    const gateway = new PublicSupportGateway(auth, drizzleWithSelect(query.select));

    await gateway.handleConnection(client);

    expect(auth.authenticate).toHaveBeenCalledWith('support_session=token', 'https://widget.example.test');
    expect(client.join.mock.calls.map(([value]) => value)).toEqual([
      'public:requester:integration-001:requester-001',
      'public:conversation:conversation-001',
      'public:ticket:ticket-001',
      'public:conversation:conversation-002',
    ]);
    expect(query.where).toHaveBeenCalledTimes(1);
    expect(query.limit).toHaveBeenCalledWith(100);
    expect(client.emit).toHaveBeenCalledWith('connected', { realtime: true });
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it('deconnecte sans interroger la base quand la session est invalide', async () => {
    auth.authenticate.mockRejectedValue(new Error('invalid session'));
    const query = conversationQuery([]);
    const gateway = new PublicSupportGateway(auth, drizzleWithSelect(query.select));

    await gateway.handleConnection(client);

    expect(query.select).not.toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });
});
