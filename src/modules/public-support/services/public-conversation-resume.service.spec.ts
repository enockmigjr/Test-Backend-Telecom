import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { PublicPrincipal } from '../../external-identity/interfaces/public-principal.interface';
import { TicketsService } from '../../tickets/services/tickets.service';
import { PublicAdmissionPolicyService } from './public-admission-policy.service';
import { PublicConversationService } from './public-conversation.service';
import { PublicTicketAccessService } from './public-ticket-access.service';
import { PreTicketAttachmentMaterializerService } from './pre-ticket-attachment-materializer.service';

describe('PublicConversationService.get', () => {
  const principal: PublicPrincipal = {
    kind: 'PUBLIC',
    sub: 'requester-1',
    externalRequesterId: 'requester-1',
    supportIntegrationId: 'integration-1',
    jti: 'session-1',
  };
  const requireConversation = jest.fn();
  let service: PublicConversationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        PublicConversationService,
        { provide: DrizzleProvider, useValue: {} },
        { provide: PublicTicketAccessService, useValue: { requireConversation } },
        { provide: PublicAdmissionPolicyService, useValue: {} },
        { provide: TicketsService, useValue: {} },
        { provide: PreTicketAttachmentMaterializerService, useValue: {} },
      ],
    }).compile();
    service = moduleRef.get(PublicConversationService);
  });

  it('retourne le brouillon public normalise apres controle du demandeur et de l integration', async () => {
    const createdAt = new Date('2026-08-01T10:00:00.000Z');
    const lastMessageAt = new Date('2026-08-02T11:00:00.000Z');
    requireConversation.mockResolvedValue({
      id: 'conversation-1',
      currentState: 'DRAFT',
      status: 'OPEN',
      ticketId: null,
      context: {
        draft: {
          categoryId: 'category-1',
          title: '  Coupure fibre  ',
          description: '  Aucun signal  ',
          impact: 'HIGH',
          urgency: 'MEDIUM',
          serviceKey: '  fibre  ',
          internalRoutingHint: 'noc-secret',
        },
        privateContext: 'non-public',
      },
      lastMessageAt,
      createdAt,
    });

    await expect(service.get('conversation-1', principal)).resolves.toEqual({
      data: {
        id: 'conversation-1',
        state: 'DRAFT',
        status: 'OPEN',
        ticketId: null,
        draft: {
          categoryId: 'category-1',
          title: 'Coupure fibre',
          description: 'Aucun signal',
          impact: 'HIGH',
          urgency: 'MEDIUM',
          serviceKey: 'fibre',
        },
        lastMessageAt,
        createdAt,
      },
    });
    expect(requireConversation).toHaveBeenCalledWith('conversation-1', principal);
  });

  it('remplace un brouillon incomplet par null sans exposer son contenu brut', async () => {
    requireConversation.mockResolvedValue({
      id: 'conversation-1',
      currentState: 'QUALIFY',
      status: 'OPEN',
      ticketId: null,
      context: { draft: { description: 'incomplet', privateValue: 'secret' } },
      lastMessageAt: null,
      createdAt: new Date('2026-08-01T10:00:00.000Z'),
    });

    const result = await service.get('conversation-1', principal);

    expect(result.data.draft).toBeNull();
    expect(result.data).not.toHaveProperty('context');
  });

  it('propage le 404 du controle d acces pour une conversation hors perimetre', async () => {
    requireConversation.mockRejectedValue(new NotFoundException('Conversation introuvable.'));

    await expect(service.get('conversation-autre', principal)).rejects.toBeInstanceOf(NotFoundException);
    expect(requireConversation).toHaveBeenCalledWith('conversation-autre', principal);
  });
});
