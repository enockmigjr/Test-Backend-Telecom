import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

export const uuid: SchemaObject = { type: 'string', format: 'uuid' };
export const dateTime: SchemaObject = { type: 'string', format: 'date-time' };
export const nullableDateTime: SchemaObject = { ...dateTime, nullable: true };
export const nullableString: SchemaObject = { type: 'string', nullable: true };
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
export const priority: SchemaObject = { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] };
export const severity: SchemaObject = { type: 'string', enum: ['S1', 'S2', 'S3', 'S4'] };
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
