/**
 * ============================================================================
 * FICHIER : src/modules/email/email.module.ts
 * RÔLE : Module NestJS organisant le composant email.
 * EXPLICATION :
 * Ce module regroupe et configure les contrôleurs, services, répertoires et dépendances de email.
 * 1. Définit les éléments internes du domaine fonctionnel.
 * 2. Rend les services accessibles aux autres modules ayant importé celui-ci.
 * ============================================================================
 */

import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';

@Global()
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
/**
 * Module NestJS `EmailModule` configurant les dépendances, contrôleurs et services associés.
 */
export class EmailModule {}
