/**
 * ============================================================================
 * FICHIER : src/modules/sla/sla.module.ts
 * RÔLE : Module NestJS organisant le composant sla.
 * EXPLICATION :
 * Ce module regroupe et configure les contrôleurs, services, répertoires et dépendances de sla.
 * 1. Définit les éléments internes du domaine fonctionnel.
 * 2. Rend les services accessibles aux autres modules ayant importé celui-ci.
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { SlaPoliciesController } from './sla-policies.controller';
import { SlaPoliciesService } from './sla-policies.service';
import { SlaEngineService } from './sla-engine.service';
import { WebSocketModule } from '../../websocket/websocket.module';
import { SlaAlertNotifierService } from './sla-alert-notifier.service';
import { SlaAlertProcessorService } from './sla-alert-processor.service';
import { SlaAutoCloseService } from './sla-auto-close.service';

/**
 * Module SLA.
 * Importe WebSocketModule pour que SlaEngineService puisse émettre
 * des alertes en temps réel aux utilisateurs concernés.
 */
@Module({
  imports: [WebSocketModule],
  controllers: [SlaPoliciesController],
  providers: [
    SlaPoliciesService,
    SlaEngineService,
    SlaAlertNotifierService,
    SlaAlertProcessorService,
    SlaAutoCloseService,
  ],
  exports: [SlaPoliciesService, SlaEngineService],
})
/**
 * Module NestJS `SlaModule` configurant les dépendances, contrôleurs et services associés.
 */
export class SlaModule {}
