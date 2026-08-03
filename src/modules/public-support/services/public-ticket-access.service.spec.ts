import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { PublicPrincipal } from '../../external-identity/interfaces/public-principal.interface';
import { PublicTicketAccessService } from './public-ticket-access.service';

function selectQuery(result: readonly unknown[]) {
  const builder = {
    from: jest.fn(),
    where: jest.fn(),
    limit: jest.fn().mockResolvedValue(result),
  };
  builder.from.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  return builder;
}

describe('PublicTicketAccessService', () => {
  const principal: PublicPrincipal = {
    kind: 'PUBLIC',
    sub: 'requester-1',
    externalRequesterId: 'requester-1',
    supportIntegrationId: 'integration-1',
    jti: 'session-1',
  };
  const select = jest.fn();
  let service: PublicTicketAccessService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [PublicTicketAccessService, { provide: DrizzleProvider, useValue: { db: { select } } }],
    }).compile();
    service = moduleRef.get(PublicTicketAccessService);
  });

  it('retourne uniquement le ticket trouvé dans le périmètre public', async () => {
    const ticket = { id: 'ticket-1', requesterId: 'requester-1' };
    select.mockReturnValue(selectQuery([ticket]));

    await expect(service.requireTicket('ticket-1', principal)).resolves.toBe(ticket);
  });

  it('masque un ticket hors périmètre comme introuvable', async () => {
    select.mockReturnValue(selectQuery([]));

    await expect(service.requireTicket('ticket-other', principal)).rejects.toThrow(NotFoundException);
  });

  it('masque une conversation hors périmètre comme introuvable', async () => {
    select.mockReturnValue(selectQuery([]));

    await expect(service.requireConversation('conversation-other', principal)).rejects.toThrow(NotFoundException);
  });
});
