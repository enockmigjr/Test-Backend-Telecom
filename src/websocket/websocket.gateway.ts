import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/ws',
})
export class TelecomWebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TelecomWebSocketGateway.name);
  private readonly connectedClients = new Map<string, Set<string>>();

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth?.token || client.handshake.query?.token;
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = jwt.verify(token as string, process.env['JWT_ACCESS_SECRET'] || 'dev-secret') as {
        sub: string;
        email: string;
        role: string;
        departmentId: string;
      };

      // Joindre les rooms automatiquement
      client.join(`user:${payload.sub}`);
      client.join(`department:${payload.departmentId}`);
      client.join(`role:${payload.role}`);

      // Stocker le mapping client → user
      if (!this.connectedClients.has(payload.sub)) {
        this.connectedClients.set(payload.sub, new Set());
      }
      this.connectedClients.get(payload.sub)?.add(client.id);

      this.logger.log(`WebSocket connecté: ${payload.email} (${client.id})`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`WebSocket déconnecté: ${client.id}`);
    // Nettoyer le mapping
    for (const [userId, sockets] of this.connectedClients.entries()) {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.connectedClients.delete(userId);
      }
    }
  }

  /**
   * Émet un événement à un utilisateur spécifique (tous ses sockets).
   */
  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  /**
   * Émet un événement à tous les utilisateurs d'un département.
   */
  emitToDepartment(departmentId: string, event: string, payload: unknown): void {
    this.server.to(`department:${departmentId}`).emit(event, payload);
  }

  /**
   * Émet un événement à tous les utilisateurs ayant un rôle.
   */
  emitToRole(role: string, event: string, payload: unknown): void {
    this.server.to(`role:${role}`).emit(event, payload);
  }

  @SubscribeMessage('ping')
  handlePing(): { event: string; data: string } {
    return { event: 'pong', data: new Date().toISOString() };
  }

  isUserConnected(userId: string): boolean {
    return this.connectedClients.has(userId) && (this.connectedClients.get(userId)?.size || 0) > 0;
  }
}
