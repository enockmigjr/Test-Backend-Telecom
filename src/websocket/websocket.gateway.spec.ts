import { Test } from '@nestjs/testing';
import { Server, Socket } from 'socket.io';
import { DeepMockProxy, mock, mockDeep, MockProxy } from 'jest-mock-extended';

import { MetricsService } from '../common/metrics/metrics.service';
import { JwtPayload } from '../modules/auth/interfaces/jwt-payload.interface';
import { TelecomWebSocketGateway } from './websocket.gateway';
import { WebSocketAuthService } from './websocket-auth.service';

const payload: JwtPayload = {
  sub: 'user-001',
  email: 'agent@telecom.local',
  role: 'CUSTOMER_SERVICE_AGENT',
  departmentId: 'dept-001',
  mustChangePassword: false,
  jti: 'jti-001',
};

function makeSocket(cookie?: string): jest.Mocked<Partial<Socket>> {
  return {
    id: 'socket-001',
    handshake: { headers: { cookie }, auth: {}, query: {} } as Socket['handshake'],
    join: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(),
    disconnect: jest.fn(),
  };
}

describe('TelecomWebSocketGateway', () => {
  let gateway: TelecomWebSocketGateway;
  let auth: MockProxy<WebSocketAuthService>;
  let metrics: DeepMockProxy<MetricsService>;
  let server: jest.Mocked<Partial<Server>>;
  let disconnectSockets: jest.Mock;

  beforeEach(async () => {
    auth = mock<WebSocketAuthService>();
    metrics = mockDeep<MetricsService>();
    disconnectSockets = jest.fn();
    server = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      in: jest.fn(() => ({ disconnectSockets })) as unknown as Server['in'],
    };

    const module = await Test.createTestingModule({
      providers: [
        TelecomWebSocketGateway,
        { provide: WebSocketAuthService, useValue: auth },
        { provide: MetricsService, useValue: metrics },
      ],
    }).compile();

    gateway = module.get(TelecomWebSocketGateway);
    gateway.server = server as unknown as Server;
  });

  it('authentifie le cookie puis joint uniquement les rooms calculees par le serveur', async () => {
    auth.authenticate.mockResolvedValue(payload);
    const client = makeSocket('access_token=jwt-value');

    await gateway.handleConnection(client as unknown as Socket);

    expect(auth.authenticate).toHaveBeenCalledWith('access_token=jwt-value');
    expect(client.join).toHaveBeenCalledTimes(3);
    expect(client.join).toHaveBeenCalledWith('user:user-001');
    expect(client.join).toHaveBeenCalledWith('department:dept-001');
    expect(client.join).toHaveBeenCalledWith('session:jti-001');
    expect(client.join).not.toHaveBeenCalledWith(expect.stringMatching(/^role:/));
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it('rejette une connexion dont le cookie est absent ou invalide', async () => {
    auth.authenticate.mockRejectedValue(new Error('unauthorized'));
    const client = makeSocket();

    await gateway.handleConnection(client as unknown as Socket);

    expect(client.disconnect).toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
  });

  it('ne decompte pas une connexion jamais authentifiee', () => {
    gateway.handleDisconnect(makeSocket() as unknown as Socket);
    expect(metrics.wsConnections.dec).not.toHaveBeenCalled();
  });

  it('suit plusieurs sockets legitimes du meme utilisateur', async () => {
    auth.authenticate.mockResolvedValue(payload);
    const first = makeSocket('access_token=one');
    const second = { ...makeSocket('access_token=two'), id: 'socket-002' };

    await gateway.handleConnection(first as unknown as Socket);
    await gateway.handleConnection(second as unknown as Socket);

    expect(gateway.isUserConnected(payload.sub)).toBe(true);
    expect(gateway.getConnectionCount()).toBe(2);
  });

  it('deconnecte uniquement les sockets de la session revoquee', async () => {
    const first = makeSocket('access_token=one');
    const second = { ...makeSocket('access_token=two'), id: 'socket-002', disconnect: jest.fn() };
    auth.authenticate.mockResolvedValueOnce(payload).mockResolvedValueOnce({ ...payload, jti: 'jti-002' });
    await gateway.handleConnection(first as unknown as Socket);
    await gateway.handleConnection(second as unknown as Socket);

    gateway.handleSessionRevoked({ userId: payload.sub, jti: payload.jti });

    expect(server.in).toHaveBeenCalledWith('session:jti-001');
    expect(disconnectSockets).toHaveBeenCalledWith(true);
  });

  it("deconnecte tous les onglets lors d'un logout-all", async () => {
    auth.authenticate.mockResolvedValue(payload);
    const first = makeSocket('access_token=one');
    const second = { ...makeSocket('access_token=two'), id: 'socket-002', disconnect: jest.fn() };
    await gateway.handleConnection(first as unknown as Socket);
    await gateway.handleConnection(second as unknown as Socket);

    gateway.handleUserSessionsRevoked({ userId: payload.sub });

    expect(server.in).toHaveBeenCalledWith('user:user-001');
    expect(disconnectSockets).toHaveBeenCalledWith(true);
  });

  it('emet uniquement depuis les APIs serveur', () => {
    gateway.emitToUser('user-001', 'ticket.created', { id: 'ticket-001' });
    expect(server.to).toHaveBeenCalledWith('user:user-001');
    expect(server.emit).toHaveBeenCalledWith('ticket.created', { id: 'ticket-001' });
  });

  it('repond au heartbeat sans modifier les rooms', () => {
    expect(gateway.handlePing()).toEqual({ event: 'pong', data: expect.any(String) });
  });
});
