/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { TelecomWebSocketGateway } from './websocket.gateway';
import { MetricsService } from '../common/metrics/metrics.service';
import { Server, Socket } from 'socket.io';

// ---------------------------------------------------------------------------
// Mock jsonwebtoken avant tout import (evite "Cannot redefine property")
// ---------------------------------------------------------------------------
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));
import * as jwt from 'jsonwebtoken';
const mockedJwtVerify = jwt.verify as jest.Mock;

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
function makeMockGauge() {
  return { inc: jest.fn(), dec: jest.fn(), set: jest.fn() };
}

const mockMetricsService = {
  wsConnections: makeMockGauge(),
  activeUsers: makeMockGauge(),
  ticketsCreatedTotal: makeMockGauge(),
  ticketsActive: makeMockGauge(),
  slaBreachesTotal: makeMockGauge(),
  httpRequestsTotal: makeMockGauge(),
  httpRequestDuration: makeMockGauge(),
  dbPoolConnections: makeMockGauge(),
};

const validPayload = {
  sub: 'user-001',
  email: 'agent@telecom.local',
  role: 'CUSTOMER_SERVICE_AGENT',
  departmentId: 'dept-001',
};

const VALID_TOKEN = 'valid-jwt-token';
const INVALID_TOKEN = 'invalid-jwt-token';

/** Helper pour creer un Socket mocke avec des valeurs par defaut. */
function makeSocket(overrides: Partial<Socket> = {}): jest.Mocked<Partial<Socket>> {
  return {
    id: 'socket-001',
    handshake: { auth: {}, query: {} } as any,
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(),
    disconnect: jest.fn(),
    ...overrides,
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('TelecomWebSocketGateway', () => {
  let gateway: TelecomWebSocketGateway;
  let mockServer: jest.Mocked<Partial<Server>>;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockedJwtVerify.mockReset();

    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [TelecomWebSocketGateway, { provide: MetricsService, useValue: mockMetricsService }],
    }).compile();

    gateway = module.get<TelecomWebSocketGateway>(TelecomWebSocketGateway);
    gateway.server = mockServer as unknown as Server;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // handleConnection() — Authentification JWT
  // =========================================================================
  describe('handleConnection — Authentification JWT', () => {
    it('doit accepter la connexion avec un token JWT valide dans handshake.auth.token', async () => {
      mockedJwtVerify.mockReturnValue(validPayload);
      const client = makeSocket({
        handshake: { auth: { token: VALID_TOKEN }, query: {} } as any,
      });

      await gateway.handleConnection(client as unknown as Socket);

      expect(mockedJwtVerify).toHaveBeenCalledWith(VALID_TOKEN, expect.any(String));
      expect(client.join).toHaveBeenCalledWith('user:user-001');
      expect(client.join).toHaveBeenCalledWith('department:dept-001');
      expect(client.join).toHaveBeenCalledWith('role:CUSTOMER_SERVICE_AGENT');
      expect(client.emit).toHaveBeenCalledWith(
        'connected',
        expect.objectContaining({
          userId: 'user-001',
          email: 'agent@telecom.local',
        }),
      );
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('doit accepter la connexion avec un token JWT valide dans handshake.query.token', async () => {
      mockedJwtVerify.mockReturnValue(validPayload);
      const client = makeSocket({
        handshake: { auth: {}, query: { token: VALID_TOKEN } } as any,
      });

      await gateway.handleConnection(client as unknown as Socket);

      expect(mockedJwtVerify).toHaveBeenCalledWith(VALID_TOKEN, expect.any(String));
      expect(client.join).toHaveBeenCalledWith('user:user-001');
      expect(client.join).toHaveBeenCalledWith('department:dept-001');
      expect(client.join).toHaveBeenCalledWith('role:CUSTOMER_SERVICE_AGENT');
    });

    it('doit rejeter la connexion si aucun token est fourni', async () => {
      const client = makeSocket({ handshake: { auth: {}, query: {} } as any });

      await gateway.handleConnection(client as unknown as Socket);

      expect(client.disconnect).toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });

    it('doit rejeter la connexion si le token JWT est invalide', async () => {
      mockedJwtVerify.mockImplementation(() => {
        throw new Error('jwt malformed');
      });
      const client = makeSocket({
        handshake: { auth: { token: INVALID_TOKEN }, query: {} } as any,
      });

      await gateway.handleConnection(client as unknown as Socket);

      expect(client.disconnect).toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });

    it('doit incrementer wsConnections et mettre a jour activeUsers apres connexion', async () => {
      mockedJwtVerify.mockReturnValue(validPayload);
      const client = makeSocket({
        handshake: { auth: { token: VALID_TOKEN }, query: {} } as any,
      });

      await gateway.handleConnection(client as unknown as Socket);

      expect(mockMetricsService.wsConnections.inc).toHaveBeenCalled();
      expect(mockMetricsService.activeUsers.set).toHaveBeenCalled();
    });

    it('doit gerer plusieurs connexions du meme utilisateur (multi-onglets)', async () => {
      mockedJwtVerify.mockReturnValue(validPayload);
      const client1 = makeSocket({ id: 'socket-001', handshake: { auth: { token: VALID_TOKEN }, query: {} } as any });
      const client2 = makeSocket({ id: 'socket-002', handshake: { auth: { token: VALID_TOKEN }, query: {} } as any });

      await gateway.handleConnection(client1 as unknown as Socket);
      await gateway.handleConnection(client2 as unknown as Socket);

      expect(gateway.isUserConnected('user-001')).toBe(true);
      expect(gateway.getConnectionCount()).toBe(2);
    });
  });

  // =========================================================================
  // handleDisconnect()
  // =========================================================================
  describe('handleDisconnect', () => {
    it('doit nettoyer les indexes a la deconnexion', async () => {
      mockedJwtVerify.mockReturnValue(validPayload);
      const client = makeSocket({
        id: 'socket-001',
        handshake: { auth: { token: VALID_TOKEN }, query: {} } as any,
      });

      await gateway.handleConnection(client as unknown as Socket);
      expect(gateway.isUserConnected('user-001')).toBe(true);

      gateway.handleDisconnect(client as unknown as Socket);

      expect(gateway.isUserConnected('user-001')).toBe(false);
    });

    it('doit decrementer wsConnections apres deconnexion', () => {
      const client = makeSocket({ id: 'socket-001' });

      gateway.handleDisconnect(client as unknown as Socket);

      expect(mockMetricsService.wsConnections.dec).toHaveBeenCalled();
      expect(mockMetricsService.activeUsers.set).toHaveBeenCalled();
    });

    it('doit gerer la deconnexion sans utilisateur indexe (cas silencieux)', () => {
      const client = makeSocket({ id: 'unknown-socket' });

      expect(() => gateway.handleDisconnect(client as unknown as Socket)).not.toThrow();
      expect(mockMetricsService.wsConnections.dec).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // emitToUser()
  // =========================================================================
  describe('emitToUser', () => {
    it('doit emettre un evenement a la room user:{userId}', () => {
      const mockTo = jest.fn().mockReturnThis();
      gateway.server.to = mockTo;

      gateway.emitToUser('user-001', 'ticket.created', { id: 'ticket-001' });

      expect(mockTo).toHaveBeenCalledWith('user:user-001');
      expect(mockServer.emit).toHaveBeenCalledWith('ticket.created', { id: 'ticket-001' });
    });

    it('doit accepter n importe quel type de payload', () => {
      const mockTo = jest.fn().mockReturnThis();
      gateway.server.to = mockTo;

      gateway.emitToUser('user-001', 'notification.created', { message: 'Nouveau ticket' });
      expect(mockTo).toHaveBeenCalledWith('user:user-001');
      expect(mockServer.emit).toHaveBeenCalledWith('notification.created', { message: 'Nouveau ticket' });
    });
  });

  // =========================================================================
  // emitToDepartment()
  // =========================================================================
  describe('emitToDepartment', () => {
    it('doit emettre un evenement a la room department:{departmentId}', () => {
      const mockTo = jest.fn().mockReturnThis();
      gateway.server.to = mockTo;

      gateway.emitToDepartment('dept-001', 'ticket.escalated', { id: 'ticket-001' });

      expect(mockTo).toHaveBeenCalledWith('department:dept-001');
      expect(mockServer.emit).toHaveBeenCalledWith('ticket.escalated', { id: 'ticket-001' });
    });
  });

  // =========================================================================
  // emitToRole()
  // =========================================================================
  describe('emitToRole', () => {
    it('doit emettre un evenement a la room role:{role}', () => {
      const mockTo = jest.fn().mockReturnThis();
      gateway.server.to = mockTo;

      gateway.emitToRole('SUPERVISOR', 'ticket.sla_breached', { id: 'ticket-001' });

      expect(mockTo).toHaveBeenCalledWith('role:SUPERVISOR');
      expect(mockServer.emit).toHaveBeenCalledWith('ticket.sla_breached', { id: 'ticket-001' });
    });
  });

  // =========================================================================
  // broadcast()
  // =========================================================================
  describe('broadcast', () => {
    it('doit diffuser un evenement a tous les clients connectes', () => {
      gateway.broadcast('system.maintenance', { message: 'Maintenance prevue a 22h' });

      expect(mockServer.emit).toHaveBeenCalledWith('system.maintenance', { message: 'Maintenance prevue a 22h' });
    });
  });

  // =========================================================================
  // isUserConnected()
  // =========================================================================
  describe('isUserConnected', () => {
    it('doit retourner false si l utilisateur n est pas connecte', () => {
      expect(gateway.isUserConnected('user-unknown')).toBe(false);
    });

    it('doit retourner true si l utilisateur a au moins un socket actif', async () => {
      mockedJwtVerify.mockReturnValue(validPayload);
      const client = makeSocket({
        id: 'socket-001',
        handshake: { auth: { token: VALID_TOKEN }, query: {} } as any,
      });

      await gateway.handleConnection(client as unknown as Socket);

      expect(gateway.isUserConnected('user-001')).toBe(true);
    });
  });

  // =========================================================================
  // getConnectionCount()
  // =========================================================================
  describe('getConnectionCount', () => {
    it('doit retourner 0 quand aucun client nest connecte', () => {
      expect(gateway.getConnectionCount()).toBe(0);
    });

    it('doit retourner le nombre de connexions actives', async () => {
      mockedJwtVerify.mockReturnValue(validPayload);
      const client1 = makeSocket({ id: 'socket-001', handshake: { auth: { token: VALID_TOKEN }, query: {} } as any });
      const client2 = makeSocket({ id: 'socket-002', handshake: { auth: { token: VALID_TOKEN }, query: {} } as any });

      await gateway.handleConnection(client1 as unknown as Socket);
      await gateway.handleConnection(client2 as unknown as Socket);

      expect(gateway.getConnectionCount()).toBe(2);
    });
  });

  // =========================================================================
  // handlePing() — ping/pong
  // =========================================================================
  describe('handlePing — Heartbeat', () => {
    it('doit retourner un objet avec event pong', () => {
      const result = gateway.handlePing();

      expect(result).toHaveProperty('event', 'pong');
      expect(result).toHaveProperty('data');
    });

    it('doit contenir une date ISO valide dans data', () => {
      const result = gateway.handlePing();

      expect(new Date(result.data).toISOString()).toBe(result.data);
    });
  });

  // =========================================================================
  // handleJoinRoom()
  // =========================================================================
  describe('handleJoinRoom', () => {
    it('doit rejoindre une room valide et emettre room_joined', async () => {
      const client = makeSocket({ id: 'socket-001' });

      await gateway.handleJoinRoom(client as unknown as Socket, { room: 'custom-room' });

      expect(client.join).toHaveBeenCalledWith('custom-room');
      expect(client.emit).toHaveBeenCalledWith('room_joined', { room: 'custom-room' });
    });

    it('ne doit rien faire si data ou room est manquant', async () => {
      const client = makeSocket({ id: 'socket-001' });

      await gateway.handleJoinRoom(client as unknown as Socket, null as any);

      expect(client.join).not.toHaveBeenCalled();
      expect(client.emit).not.toHaveBeenCalled();
    });

    it('ne doit rien faire si room est vide', async () => {
      const client = makeSocket({ id: 'socket-001' });

      await gateway.handleJoinRoom(client as unknown as Socket, { room: '' });

      expect(client.join).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // handleLeaveRoom()
  // =========================================================================
  describe('handleLeaveRoom', () => {
    it('doit quitter une room valide et emettre room_left', async () => {
      const client = makeSocket({ id: 'socket-001' });

      await gateway.handleLeaveRoom(client as unknown as Socket, { room: 'custom-room' });

      expect(client.leave).toHaveBeenCalledWith('custom-room');
      expect(client.emit).toHaveBeenCalledWith('room_left', { room: 'custom-room' });
    });

    it('ne doit rien faire si data ou room est manquant', async () => {
      const client = makeSocket({ id: 'socket-001' });

      await gateway.handleLeaveRoom(client as unknown as Socket, null as any);

      expect(client.leave).not.toHaveBeenCalled();
      expect(client.emit).not.toHaveBeenCalled();
    });

    it('ne doit rien faire si room est vide', async () => {
      const client = makeSocket({ id: 'socket-001' });

      await gateway.handleLeaveRoom(client as unknown as Socket, { room: '' });

      expect(client.leave).not.toHaveBeenCalled();
    });
  });
});
