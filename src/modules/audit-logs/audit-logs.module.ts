/**
 * ============================================================================
 * FICHIER : src/modules/audit-logs/audit-logs.module.ts
 * RÔLE : Module NestJS organisant le composant audit-logs.
 * EXPLICATION :
 * Ce module regroupe et configure les contrôleurs, services, répertoires et dépendances de audit-logs.
 * 1. Définit les éléments internes du domaine fonctionnel.
 * 2. Rend les services accessibles aux autres modules ayant importé celui-ci.
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';

@Module({
  controllers: [AuditLogsController],
  providers: [AuditLogsService],
  exports: [AuditLogsService],
})
/**
 * Module NestJS `AuditLogsModule` configurant les dépendances, contrôleurs et services associés.
 */
export class AuditLogsModule {}
