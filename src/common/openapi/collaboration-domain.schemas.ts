import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

import { dateTime, jsonValue, nullableDateTime, nullableString, uuid } from './schema-helpers';

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
