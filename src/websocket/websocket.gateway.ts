/**
 * ============================================================================
 * FICHIER : src/websocket/websocket.gateway.ts
 * RÔLE : Passerelle WebSocket principale Socket.IO (Espace de noms `/ws`).
 * EXPLICATION :
 * Ce composant gère les communications bidirectionnelles temps réel entre le serveur backend et les clients web/mobile :
 * 1. Authentification lors du Handshake WebSocket via le cookie d'accès HttpOnly ou le jeton Bearer (`WebSocketAuthService`).
 * 2. Inscription automatique du socket client dans 3 salons d'événements (Rooms) :
 *    - `user:{userId}` : Notifications individuelles et alertes personnelles.
 *    - `department:{departmentId}` : Événements métier du département (nouveaux tickets, escalades, résolutions).
 *    - `session:{jti}` : Canal d'invalidation immédiate en cas de déconnexion/révocation.
 * 3. Suivi multi-onglets des connexions actives et mise à jour des métriques Prometheus (`wsConnections`, `activeUsers`).
 * 4. Écoute des événements de domaine (`auth.session.revoked`, `auth.user-sessions.revoked`) pour couper instantanément les sockets révoqués.
 * ============================================================================
 */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MetricsService } from '../common/metrics/metrics.service';
import { WebSocketAuthService } from './websocket-auth.service';
import { websocketCorsOrigin } from './websocket-cors';
import { AuthSessionRevokedEvent, AuthUserSessionsRevokedEvent } from '../modules/auth/domain/auth-session.events';

/**
 * Gateway WebSocket principal pour la plateforme.
 *
 * Connexion :
 * - Le navigateur envoie son JWT via le cookie HttpOnly pose par le BFF
 * - À la connexion, le client rejoint automatiquement :
 *   - `user:{userId}` — notifications personnelles
 *   - `department:{departmentId}` — événements du département
 *   - `session:{jti}` — révocation interne multi-instance, jamais fournie par le client
 *
 * Événements émis par le serveur :
 * - ticket.created → département
 * - ticket.assigned → user assigné
 * - ticket.escalated → user escaladé + département cible
 * - ticket.resolved → département
 * - ticket.status_changed → département
 * - ticket.sla_warning → user assigné + département
 * - ticket.sla_breached → user assigné + département
 * - notification.created → user concerné
 *
 * Événements acceptés du client :
 * - ping → pong (heartbeat)
 * Passerelle Socket.IO configurée sur le namespace `/ws` avec validation CORS et authentification JWT.
 */
@WebSocketGateway({
  cors: { origin: websocketCorsOrigin, credentials: true },
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

  constructor(
    private readonly metricsService: MetricsService,
    private readonly webSocketAuth: WebSocketAuthService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const payload = await this.webSocketAuth.authenticate(client.handshake.headers.cookie);

      // Rejoindre les rooms automatiques
      await client.join(`user:${payload.sub}`);
      await client.join(`department:${payload.departmentId}`);
      await client.join(`session:${payload.jti}`);

      // Indexation pour le tracking
      if (!this.connectedClients.has(payload.sub)) {
        this.connectedClients.set(payload.sub, new Set());
      }
      this.connectedClients.get(payload.sub)?.add(client.id);
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
        rooms: [`user:${payload.sub}`, `department:${payload.departmentId}`],
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

    if (userId) this.metricsService.wsConnections.dec();
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

  @OnEvent('auth.session.revoked')
  handleSessionRevoked(event: AuthSessionRevokedEvent): void {
    this.server.in(`session:${event.jti}`).disconnectSockets(true);
  }

  @OnEvent('auth.user-sessions.revoked')
  handleUserSessionsRevoked(event: AuthUserSessionsRevokedEvent): void {
    this.server.in(`user:${event.userId}`).disconnectSockets(true);
  }

  // ─── Handlers client → serveur ───────────────────────────────────

  @SubscribeMessage('ping')
  handlePing(): { event: string; data: string } {
    return { event: 'pong', data: new Date().toISOString() };
  }
}
