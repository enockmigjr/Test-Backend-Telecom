/**
 * ============================================================================
 * FICHIER : src/modules/auth/auth.module.ts
 * RÔLE : Module NestJS organisant le composant auth.
 * EXPLICATION :
 * Ce module regroupe et configure les contrôleurs, services, répertoires et dépendances de auth.
 * 1. Définit les éléments internes du domaine fonctionnel.
 * 2. Rend les services accessibles aux autres modules ayant importé celui-ci.
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { KeycloakJwksService } from './services/keycloak-jwks.service';
import { KeycloakTokenVerifierService } from './services/keycloak-token-verifier.service';
import { KeycloakAdminService } from './services/keycloak-admin.service';
import { KeycloakEventsService } from './services/keycloak-events.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { RequestAuthGuard } from './guards/request-auth.guard';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { ExternalIdentityModule } from '../external-identity/external-identity.module';

@Module({
  imports: [ExternalIdentityModule, AuditLogsModule, PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [AuthController],
  providers: [
    JwtStrategy,
    KeycloakJwksService,
    KeycloakTokenVerifierService,
    KeycloakAdminService,
    KeycloakEventsService,
    JwtAuthGuard,
    RequestAuthGuard,
    RolesGuard,
  ],
  exports: [
    JwtStrategy,
    KeycloakJwksService,
    KeycloakTokenVerifierService,
    KeycloakAdminService,
    KeycloakEventsService,
    JwtAuthGuard,
    RequestAuthGuard,
    RolesGuard,
    PassportModule,
  ],
})
/**
 * Module NestJS `AuthModule` configurant les dépendances, contrôleurs et services associés.
 */
export class AuthModule {}
