import { Logger } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { DrizzleProvider } from '../database/drizzle.provider';
import { supportConversations } from '../database/schemas';
import { PublicWebSocketAuthService, publicWebSocketContext } from './public-websocket-auth.service';
import { publicWebsocketCorsOrigin } from './public-websocket-cors';

@WebSocketGateway({ namespace: '/public-support', cors: { origin: publicWebsocketCorsOrigin, credentials: true } })
export class PublicSupportGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(PublicSupportGateway.name);
  private readonly sockets = new Map<string, string>();

  constructor(
    private readonly auth: PublicWebSocketAuthService,
    private readonly drizzle: DrizzleProvider,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const principal = await this.auth.authenticate(
        client.handshake.headers.cookie,
        typeof client.handshake.headers.origin === 'string' ? client.handshake.headers.origin : undefined,
        publicWebSocketContext(client.handshake.auth),
      );
      const requesterRoom = room(principal.supportIntegrationId, principal.externalRequesterId);
      await client.join(requesterRoom);
      const conversations = await this.drizzle.db
        .select({ id: supportConversations.id, ticketId: supportConversations.ticketId })
        .from(supportConversations)
        .where(
          and(
            eq(supportConversations.supportIntegrationId, principal.supportIntegrationId),
            eq(supportConversations.externalRequesterId, principal.externalRequesterId),
          ),
        )
        .orderBy(desc(supportConversations.createdAt))
        .limit(100);
      for (const value of conversations) {
        await client.join(`public:conversation:${value.id}`);
        if (value.ticketId) await client.join(`public:ticket:${value.ticketId}`);
      }
      this.sockets.set(client.id, requesterRoom);
      client.emit('connected', { realtime: true });
    } catch {
      this.logger.warn(`Connexion WebSocket publique rejetée: ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.sockets.delete(client.id);
  }

  emitRefresh(
    integrationId: string,
    requesterId: string,
    resource: 'ticket' | 'conversation' | 'attachment',
    id: string,
  ) {
    this.server.to(room(integrationId, requesterId)).emit('public.refresh', { resource, id });
  }

  @SubscribeMessage('ping')
  ping() {
    return { event: 'pong', data: new Date().toISOString() };
  }
}

function room(integrationId: string, requesterId: string): string {
  return `public:requester:${integrationId}:${requesterId}`;
}
