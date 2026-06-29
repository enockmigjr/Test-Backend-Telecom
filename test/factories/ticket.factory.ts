import { faker } from '@faker-js/faker';

/**
 * Factory pour créer des données de test ticket.
 */
export function buildTicket(overrides: Record<string, unknown> = {}) {
  return {
    title: faker.lorem.sentence({ min: 3, max: 8 }),
    description: faker.lorem.paragraph(),
    priority: 'MEDIUM',
    severity: 'S3',
    category: 'TECHNICAL',
    departmentId: faker.string.uuid(),
    assignedTeamId: faker.string.uuid(),
    ...overrides,
  };
}
