import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { MetricsService } from '../common/metrics/metrics.service';

interface JwtSocketPayload {
  sub: string;
  email: string;
  role: string;
  departmentId: string;
}

/**
 * Gateway WebSocket principal pour la plateforme.
 *
 * Connexion :
 * - Le client doit envoyer son JWT dans handshake.auth.token ou handshake.query.token
 * - À la connexion, le client rejoint automatiquement :
 *   - `user:{userId}` — notifications personnelles
 *   - `department:{departmentId}` — événements du département
 *   - `role:{role}` — événements par rôle (ex: superviseurs)
 *
 * Événements émis par le serveur :
 * - ticket.created → département + SUPERVISOR
 * - ticket.assigned → user assigné
 * - ticket.escalated → user escaladé + SUPERVISOR
 * - ticket.resolved → SUPERVISOR
 * - ticket.status_changed → SUPERVISOR
 * - ticket.sla_warning → user assigné + SUPERVISOR
 * - ticket.sla_breached → user assigné + SUPERVISOR
 * - notification.created → user concerné
 *
 * Événements acceptés du client :
 * - ping → pong (heartbeat)
 * - join_room → rejoindre une room custom
 * - leave_room → quitter une room custom
 */
@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/ws',
})
export class TelecomWebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TelecomWebSocketGateway.name);
  // Map userId → Set de socketId pour tracking multi-onglets
  private readonly connectedClients = new Map<string, Set<string>>();
  // Map socketId → userId pour nettoyage rapide à la déconnexion
  private readonly socketToUser = new Map<string, string>();

  constructor(private readonly metricsService: MetricsService) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth?.token || client.handshake.query?.token;
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = jwt.verify(token as string, process.env['JWT_ACCESS_SECRET'] || 'dev-secret') as JwtSocketPayload;

      // Rejoindre les rooms automatiques
      await client.join(`user:${payload.sub}`);
      await client.join(`department:${payload.departmentId}`);
      await client.join(`role:${payload.role}`);

      // Indexation pour le tracking
      if (!this.connectedClients.has(payload.sub)) {
        this.connectedClients.set(payload.sub, new Set());
      }
      this.connectedClients.get(payload.sub)!.add(client.id);
      this.socketToUser.set(client.id, payload.sub);

      // Métriques Prometheus
      this.metricsService.wsConnections.inc();
      this.metricsService.activeUsers.set(this.connectedClients.size);

      this.logger.log(`WebSocket connecté: ${payload.email} [${payload.role}] (socket: ${client.id})`);

      // Confirmer la connexion au client
      client.emit('connected', {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
        rooms: [`user:${payload.sub}`, `department:${payload.departmentId}`, `role:${payload.role}`],
      });
    } catch {
      this.logger.warn(`Connexion WebSocket rejetée: JWT invalide (socket: ${client.id})`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = this.socketToUser.get(client.id);
    this.socketToUser.delete(client.id);

    if (userId) {
      const sockets = this.connectedClients.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.connectedClients.delete(userId);
        }
      }
    }

    this.metricsService.wsConnections.dec();
    this.metricsService.activeUsers.set(this.connectedClients.size);

    this.logger.log(`WebSocket déconnecté: socket ${client.id}`);
  }

  // ─── Méthodes d'émission ─────────────────────────────────────────

  /** Émet un événement à un utilisateur spécifique (tous ses onglets/appareils). */
  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  /** Émet un événement à tous les utilisateurs d'un département. */
  emitToDepartment(departmentId: string, event: string, payload: unknown): void {
    this.server.to(`department:${departmentId}`).emit(event, payload);
  }

  /** Émet un événement à tous les utilisateurs ayant un rôle spécifique. */
  emitToRole(role: string, event: string, payload: unknown): void {
    this.server.to(`role:${role}`).emit(event, payload);
  }

  /** Diffuse un événement à TOUS les clients connectés. */
  broadcast(event: string, payload: unknown): void {
    this.server.emit(event, payload);
  }

  /** Vérifie si un utilisateur a au moins un socket actif. */
  isUserConnected(userId: string): boolean {
    return this.connectedClients.has(userId) && (this.connectedClients.get(userId)?.size ?? 0) > 0;
  }

  /** Retourne le nombre de connexions actives (multi-sockets). */
  getConnectionCount(): number {
    return this.socketToUser.size;
  }

  // ─── Handlers client → serveur ───────────────────────────────────

  @SubscribeMessage('ping')
  handlePing(): { event: string; data: string } {
    return { event: 'pong', data: new Date().toISOString() };
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() data: { room: string }): Promise<void> {
    if (data?.room) {
      await client.join(data.room);
      client.emit('room_joined', { room: data.room });
      this.logger.debug(`Socket ${client.id} a rejoint la room: ${data.room}`);
    }
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(@ConnectedSocket() client: Socket, @MessageBody() data: { room: string }): Promise<void> {
    if (data?.room) {
      await client.leave(data.room);
      client.emit('room_left', { room: data.room });
    }
  }
}
