/**
 * ============================================================================
 * FICHIER : src/common/openapi/collaboration-domain.schemas.ts
 * RÔLE : Définitions OpenAPI Swagger pour le domaine de collaboration et de traçabilité.
 * EXPLICATION :
 * Ce module contient les schémas JSON Schema pour Swagger UI décrivant les entités de collaboration :
 * 1. `TicketComment` : Commentaires publics visibles par le client et les techniciens.
 * 2. `InternalNote` : Notes de travail internes confidentielles (masquées pour FIELD_TECHNICIAN).
 * 3. `Attachment` : Métadonnées des fichiers joints (nom d'origine, type MIME, taille, clé S3/MinIO).
 * 4. `Notification` : Alertes et messages in-app adressés aux utilisateurs.
 * 5. `AuditLog` : Entrées du journal d'audit immuable (action, entité, instantanés oldValue/newValue).
 * ============================================================================
 */

import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

import { dateTime, jsonValue, nullableDateTime, nullableString, uuid } from './schema-helpers';

/** Propriétés communes réutilisées pour les messages (Commentaires publics et Notes internes). */
const messageProperties: Record<string, SchemaObject> = {
  id: uuid,
  ticketId: uuid,
  authorId: uuid,
  content: { type: 'string' },
  createdAt: dateTime,
  updatedAt: dateTime,
  authorFirstName: { type: 'string' },
  authorLastName: { type: 'string' },
  authorRole: { type: 'string' },
};

/**
 * Schémas OpenAPI Swagger exportés pour le domaine de collaboration.
 */
export const COLLABORATION_DOMAIN_SCHEMAS: Record<string, SchemaObject> = {
  TicketComment: {
    type: 'object',
    required: ['id', 'ticketId', 'authorId', 'content', 'createdAt', 'updatedAt'],
    properties: messageProperties,
  },
  InternalNote: {
    type: 'object',
    required: ['id', 'ticketId', 'authorId', 'content', 'createdAt', 'updatedAt'],
    properties: messageProperties,
  },
  Attachment: {
    type: 'object',
    required: ['id', 'uploadedBy', 'objectKey', 'bucketName', 'originalFilename', 'mimeType', 'fileSize', 'createdAt'],
    properties: {
      id: uuid,
      ticketId: { ...uuid, nullable: true },
      commentId: { ...uuid, nullable: true },
      internalNoteId: { ...uuid, nullable: true },
      uploadedBy: uuid,
      objectKey: { type: 'string' },
      bucketName: { type: 'string' },
      originalFilename: { type: 'string' },
      mimeType: { type: 'string' },
      fileSize: { type: 'integer', minimum: 0 },
      createdAt: dateTime,
    },
  },
  Notification: {
    type: 'object',
    required: ['id', 'userId', 'type', 'title', 'message', 'isRead', 'createdAt'],
    properties: {
      id: uuid,
      userId: uuid,
      type: { type: 'string' },
      title: { type: 'string' },
      message: { type: 'string' },
      referenceType: nullableString,
      referenceId: { ...uuid, nullable: true },
      isRead: { type: 'boolean' },
      readAt: nullableDateTime,
      createdAt: dateTime,
    },
  },
  AuditLog: {
    type: 'object',
    required: ['id', 'userId', 'action', 'entityType', 'entityId', 'createdAt'],
    properties: {
      id: uuid,
      userId: uuid,
      action: { type: 'string' },
      entityType: { type: 'string' },
      entityId: uuid,
      oldValue: jsonValue,
      newValue: jsonValue,
      ipAddress: nullableString,
      userAgent: nullableString,
      createdAt: dateTime,
    },
  },
};
