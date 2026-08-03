/**
 * ============================================================================
 * FICHIER : src/websocket/websocket.module.ts
 * RÔLE : Module NestJS organisant le composant websocket.
 * EXPLICATION :
 * Ce module regroupe et configure les contrôleurs, services, répertoires et dépendances de websocket.
 * 1. Définit les éléments internes du domaine fonctionnel.
 * 2. Rend les services accessibles aux autres modules ayant importé celui-ci.
 * ============================================================================
 */

import { Global, Module } from '@nestjs/common';
import { TelecomWebSocketGateway } from './websocket.gateway';
import { AuthModule } from '../modules/auth/auth.module';
import { WebSocketAuthService } from './websocket-auth.service';
import { ExternalIdentityModule } from '../modules/external-identity/external-identity.module';
import { PublicSupportGateway } from './public-support.gateway';
import { PublicWebSocketAuthService } from './public-websocket-auth.service';
import { PublicRealtimeNotifierService } from './public-realtime-notifier.service';

@Global()
@Module({
  imports: [AuthModule, ExternalIdentityModule],
  providers: [
    TelecomWebSocketGateway,
    WebSocketAuthService,
    PublicSupportGateway,
    PublicWebSocketAuthService,
    PublicRealtimeNotifierService,
  ],
  exports: [TelecomWebSocketGateway, PublicSupportGateway, PublicRealtimeNotifierService],
})
/**
 * Module NestJS `WebSocketModule` configurant les dépendances, contrôleurs et services associés.
 */
export class WebSocketModule {}
