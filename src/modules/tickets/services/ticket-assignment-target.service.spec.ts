import { BadRequestException } from '@nestjs/common';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { TicketAssignmentTargetService } from './ticket-assignment-target.service';

describe('TicketAssignmentTargetService', () => {
  const limit = jest.fn();
  const db = {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({ limit })),
      })),
    })),
  };
  let service: TicketAssignmentTargetService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TicketAssignmentTargetService({ db } as unknown as DrizzleProvider);
  });

  it('accepte uniquement une cible active du departement attendu', async () => {
    limit.mockResolvedValue([{ id: 'user-001' }]);

    await expect(service.assertEligible('user-001', 'dept-001')).resolves.toBeUndefined();
  });

  it('refuse une cible absente, inactive, supprimee ou hors departement', async () => {
    limit.mockResolvedValue([]);

    await expect(service.assertEligible('user-002', 'dept-001')).rejects.toBeInstanceOf(BadRequestException);
  });
});
