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

@Global()
@Module({
  imports: [AuthModule],
  providers: [TelecomWebSocketGateway, WebSocketAuthService],
  exports: [TelecomWebSocketGateway],
})
/**
 * Module NestJS `WebSocketModule` configurant les dépendances, contrôleurs et services associés.
 */
export class WebSocketModule {}
