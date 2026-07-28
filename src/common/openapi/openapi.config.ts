import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

import { completeOpenApiDocument } from './openapi-document.completer';

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

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  let builder = new DocumentBuilder()
    .setTitle('Telecom Ticket Management API')
    .setDescription("Système de Gestion des Tickets d'Incidents Télécom")
    .setVersion('1.0')
    .addBearerAuth();

  for (const [name, description] of TAGS) {
    builder = builder.addTag(name, description);
  }

  const document = SwaggerModule.createDocument(app, builder.build());
  return completeOpenApiDocument(document);
}
