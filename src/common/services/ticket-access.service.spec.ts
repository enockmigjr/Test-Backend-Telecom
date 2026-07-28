import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { JwtPayload } from '../../modules/auth/interfaces/jwt-payload.interface';
import { TicketAccessService } from './ticket-access.service';

const user: JwtPayload = {
  sub: 'agent-001',
  email: 'agent@telecom.local',
  role: 'NOC_ENGINEER',
  departmentId: 'dept-001',
  mustChangePassword: false,
  jti: 'jti-001',
};

function query<T>(rows: T[]): Record<string, jest.Mock> {
  const builder: Record<string, jest.Mock> = {};
  for (const method of ['from', 'where', 'limit']) builder[method] = jest.fn(() => builder);
  builder['then'] = jest.fn((resolve: (value: T[]) => void) => resolve(rows));
  return builder;
}

describe('TicketAccessService', () => {
  const select = jest.fn();
  let service: TicketAccessService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [TicketAccessService, { provide: DrizzleProvider, useValue: { db: { select } } }],
    }).compile();
    service = moduleRef.get(TicketAccessService);
  });

  it('autorise un ticket visible', async () => {
    select.mockReturnValueOnce(query([{ id: 'ticket-001' }]));
    await expect(service.assertTicketVisible('ticket-001', user)).resolves.toBeUndefined();
  });

  it('refuse sans masquer un ticket existant hors scope', async () => {
    select.mockReturnValueOnce(query([])).mockReturnValueOnce(query([{ id: 'ticket-other' }]));
    await expect(service.assertTicketVisible('ticket-other', user)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('retourne 404 pour un ticket absent', async () => {
    select.mockReturnValueOnce(query([])).mockReturnValueOnce(query([]));
    await expect(service.assertTicketVisible('missing', user)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('exige exactement une association de piece jointe', async () => {
    await expect(service.resolveVisibleParent({}, user)).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.resolveVisibleParent({ ticketId: 'ticket-001', commentId: 'comment-001' }, user),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('interdit une piece jointe de note interne au technicien terrain', async () => {
    const fieldUser = { ...user, role: 'FIELD_TECHNICIAN' };
    await expect(service.resolveVisibleParent({ internalNoteId: 'note-001' }, fieldUser)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
