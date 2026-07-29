/**
 * ============================================================================
 * FICHIER : src/common/openapi/schema-helpers.ts
 * RÔLE : Helpers et sous-schémas OpenAPI Swagger réutilisables pour les types primitifs.
 * EXPLICATION :
 * Ce module centralise les sous-schémas Swagger atomiques :
 * 1. `uuid` & `dateTime` : Formats standardisés d'identifiants UUIDv7 et de dates ISO-8601.
 * 2. `nullableDateTime` & `nullableString` : Champs facultatifs ou nullables.
 * 3. `jsonValue` : Schéma polymorphe pour les objets JSON de métadonnées et d'instantanés d'audit.
 * 4. Énumérations métier : `priority` (LOW à CRITICAL), `severity` (S1 à S4) et `ticketStatus` (les 9 statuts).
 * ============================================================================
 */

import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

/** Schéma OpenAPI pour un identifiant unique UUID. */
export const uuid: SchemaObject = { type: 'string', format: 'uuid' };

/** Schéma OpenAPI pour un horodatage ISO-8601. */
export const dateTime: SchemaObject = { type: 'string', format: 'date-time' };

/** Schéma OpenAPI pour un horodatage ISO-8601 nullable. */
export const nullableDateTime: SchemaObject = { ...dateTime, nullable: true };

/** Schéma OpenAPI pour une chaîne de caractères nullable. */
export const nullableString: SchemaObject = { type: 'string', nullable: true };

/** Schéma OpenAPI polymorphe pour une valeur JSON quelconque (objet, tableau, primitif ou null). */
export const jsonValue: SchemaObject = {
  nullable: true,
  oneOf: [
    { type: 'object' },
    { type: 'array', items: {} },
    { type: 'string' },
    { type: 'number' },
    { type: 'boolean' },
  ],
};

/** Schéma OpenAPI de l'énumération des 4 niveaux de priorité (LOW, MEDIUM, HIGH, CRITICAL). */
export const priority: SchemaObject = { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] };

/** Schéma OpenAPI de l'énumération des 4 niveaux de sévérité (S1, S2, S3, S4). */
export const severity: SchemaObject = { type: 'string', enum: ['S1', 'S2', 'S3', 'S4'] };

/** Schéma OpenAPI de l'énumération des 9 statuts de la machine à états des tickets. */
export const ticketStatus: SchemaObject = {
  type: 'string',
  enum: [
    'NEW',
    'ASSIGNED',
    'IN_PROGRESS',
    'PENDING_CUSTOMER',
    'PENDING_THIRD_PARTY',
    'RESOLVED',
    'CLOSED',
    'REOPENED',
    'CANCELLED',
  ],
};
