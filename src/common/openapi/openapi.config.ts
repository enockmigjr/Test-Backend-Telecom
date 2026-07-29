/**
 * ============================================================================
 * FICHIER : src/common/openapi/openapi.config.ts
 * RÔLE : Générateur et configurateur de la spécification OpenAPI / Swagger UI.
 * EXPLICATION :
 * Ce fichier construit la documentation interactive de l'API REST (`/api/docs`) :
 * 1. Définition des métadonnées globales de l'API (titre, version, schéma de sécurité Bearer JWT).
 * 2. Organisation thématique des endpoints par balises (Tags) en français (auth, tickets, SLA, dashboard, etc.).
 * 3. Génération du document OpenAPI brut via NestJS SwaggerModule et complétion automatique.
 * ============================================================================
 */

import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

import { completeOpenApiDocument } from './openapi-document.completer';

/**
 * Liste immuable des balises (Tags) Swagger associant chaque nom de module à sa description en français.
 */
const TAGS: ReadonlyArray<readonly [string, string]> = [
  ['auth', 'Authentification'],
  ['users', 'Utilisateurs'],
  ['departments', 'Départements'],
  ['tickets', "Tickets d'incidents"],
  ['comments', 'Commentaires publics'],
  ['internal-notes', 'Notes internes'],
  ['attachments', 'Pièces jointes'],
  ['notifications', 'Notifications'],
  ['sla', 'Politiques SLA'],
  ['dashboard', 'Tableaux de bord'],
  ['audit-logs', "Journaux d'audit"],
  ['reports', 'Rapports (PDF, SLA)'],
  ['health', 'Health checks'],
  ['root', 'API Info'],
  ['metrics', 'Prometheus Metrics'],
];

/**
 * Construit et enrichit le document de spécification OpenAPI à partir de l'instance NestJS.
 *
 * @param app Instance de l'application NestJS démarrée.
 * @returns Le document OpenAPIObject complet et validé.
 */
export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  // Configuration du builder Swagger : titre, description, version et schéma d'authentification Bearer JWT
  let builder = new DocumentBuilder()
    .setTitle('Telecom Ticket Management API')
    .setDescription("Système de Gestion des Tickets d'Incidents Télécom")
    .setVersion('1.0')
    .addBearerAuth();

  // Enregistrement de l'ensemble des catégories (Tags) d'endpoints
  for (const [name, description] of TAGS) {
    builder = builder.addTag(name, description);
  }

  // Génération du document OpenAPI par introspection des contrôleurs NestJS
  const document = SwaggerModule.createDocument(app, builder.build());

  // Embellissement et complétion du schéma (ajout des schémas d'erreurs et des réponses HTTP manquantes)
  return completeOpenApiDocument(document);
}
