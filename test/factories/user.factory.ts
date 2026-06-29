import { faker } from '@faker-js/faker';

/**
 * Factory pour créer des données de test utilisateur.
 * Utilise faker pour générer des données réalistes.
 */
export function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    email: faker.internet
      .email({ firstName: faker.person.firstName(), lastName: faker.person.lastName() })
      .toLowerCase(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    role: 'CUSTOMER_SERVICE_AGENT',
    departmentId: faker.string.uuid(),
    ...overrides,
  };
}

export const VALID_ROLES = [
  'ADMINISTRATOR',
  'SUPERVISOR',
  'CUSTOMER_SERVICE_AGENT',
  'NOC_ENGINEER',
  'BILLING_AGENT',
  'TECHNICAL_SUPPORT_ENGINEER',
  'FIELD_TECHNICIAN',
];
