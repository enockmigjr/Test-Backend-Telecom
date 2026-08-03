import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { generateUuid } from '../../../common/helpers/uuidv7.helper';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { outboxEvents, supportConversations, supportMessages } from '../../../database/schemas';
import { PublicPrincipal } from '../../external-identity/interfaces/public-principal.interface';
import { TicketsService } from '../../tickets/services/tickets.service';
import { SavePublicTicketDraftDto } from '../dto/public-conversation.dto';
import { PublicTicketDraft } from '../interfaces/public-admission.interface';
import { PublicAdmissionPolicyService } from './public-admission-policy.service';
import { PublicTicketAccessService } from './public-ticket-access.service';
import { PreTicketAttachmentMaterializerService } from './pre-ticket-attachment-materializer.service';

@Injectable()
export class PublicConversationService {
  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly access: PublicTicketAccessService,
    private readonly admission: PublicAdmissionPolicyService,
    private readonly tickets: TicketsService,
    private readonly materializer: PreTicketAttachmentMaterializerService,
  ) {}

  async create(principal: PublicPrincipal, serviceKey?: string) {
    const id = generateUuid();
    await this.drizzle.runInTransaction(async () => {
      await this.drizzle.db.insert(supportConversations).values({
        id,
        supportIntegrationId: principal.supportIntegrationId,
        externalRequesterId: principal.externalRequesterId,
        sourceChannel: 'WEB_PORTAL',
        currentState: 'QUALIFY',
        context: { admissionStartedAt: new Date().toISOString(), ...(serviceKey ? { serviceKey } : {}) },
      });
      await this.writeMutationEvent(principal, id, 'PUBLIC_CONVERSATION_STARTED');
    });
    return { data: { id, state: 'QUALIFY' as const } };
  }

  async saveDraft(id: string, principal: PublicPrincipal, dto: SavePublicTicketDraftDto) {
    return this.drizzle.runInTransaction(async () => {
      const conversation = await this.access.requireConversation(id, principal);
      if (conversation.status !== 'OPEN' || conversation.ticketId)
        throw new ConflictException('Conversation déjà finalisée.');
      const draft = normalizeDraft(dto);
      await this.drizzle.db
        .update(supportConversations)
        .set({ currentState: 'DRAFT', context: { ...conversation.context, draft } })
        .where(
          and(
            eq(supportConversations.id, id),
            eq(supportConversations.supportIntegrationId, principal.supportIntegrationId),
          ),
        );
      await this.writeMutationEvent(principal, id, 'PUBLIC_DRAFT_SAVED');
      return { data: { id, state: 'DRAFT' as const, draft } };
    });
  }

  async confirm(id: string, principal: PublicPrincipal, confirmed: boolean) {
    if (!confirmed) throw new BadRequestException('La confirmation explicite est requise.');
    return this.drizzle.runInTransaction(async () => {
      const conversation = await this.access.requireConversation(id, principal);
      if (conversation.status !== 'OPEN' || conversation.ticketId)
        throw new ConflictException('Conversation déjà finalisée.');
      const draft = parseDraft(conversation.context['draft']);
      const admitted = await this.admission.admit(principal.supportIntegrationId, principal.externalRequesterId, draft);
      const mutationId = generateUuid();
      await this.drizzle.db.insert(supportMessages).values({
        id: generateUuid(),
        supportIntegrationId: principal.supportIntegrationId,
        conversationId: id,
        actorType: 'EXTERNAL_REQUESTER',
        externalRequesterId: principal.externalRequesterId,
        direction: 'INBOUND',
        content: draft.description,
        channelMetadata: { kind: 'INITIAL_REQUEST' },
      });
      const result = await this.tickets.createFromCommand({
        input: admitted.input,
        actor: {
          type: 'EXTERNAL_REQUESTER',
          externalRequesterId: principal.externalRequesterId,
          supportIntegrationId: principal.supportIntegrationId,
        },
        requester: {
          requesterId: principal.externalRequesterId,
          supportIntegrationId: principal.supportIntegrationId,
        },
        sourceChannel: conversation.sourceChannel,
        outboxEvents: [
          {
            mutationId,
            schemaVersion: 1,
            eventType: 'PUBLIC_TICKET_CREATED',
            deduplicationKey: `public-ticket-created:${mutationId}`,
            payload: { conversationId: id, routeSource: admitted.routeSource },
          },
        ],
      });
      await this.materializer.materialize(id, result.data.id, principal);
      const [updated] = await this.drizzle.db
        .update(supportConversations)
        .set({ ticketId: result.data.id, status: 'TICKET_CREATED', currentState: 'CREATED', lastMessageAt: new Date() })
        .where(and(eq(supportConversations.id, id), eq(supportConversations.status, 'OPEN')))
        .returning({ id: supportConversations.id });
      if (!updated) throw new ConflictException('Conversation déjà finalisée.');
      return { data: { conversationId: id, ticketId: result.data.id, ticketNumber: result.data.ticketNumber } };
    });
  }

  async requestHandoff(id: string, principal: PublicPrincipal, reason?: string) {
    return this.drizzle.runInTransaction(async () => {
      const conversation = await this.access.requireConversation(id, principal);
      if (conversation.status !== 'OPEN') throw new ConflictException('Conversation déjà finalisée.');
      const mutationId = generateUuid();
      await this.drizzle.db.insert(outboxEvents).values({
        id: generateUuid(),
        mutationId,
        schemaVersion: 1,
        supportIntegrationId: principal.supportIntegrationId,
        actorType: 'EXTERNAL_REQUESTER',
        externalRequesterId: principal.externalRequesterId,
        aggregateType: 'SUPPORT_CONVERSATION',
        aggregateId: id,
        eventType: 'PUBLIC_HUMAN_HANDOFF_REQUESTED',
        deduplicationKey: `public-handoff:${mutationId}`,
        payload: { conversationId: id, ...(reason ? { reason } : {}) },
      });
      await this.drizzle.db
        .update(supportConversations)
        .set({
          currentState: 'FOLLOW_UP_OR_HANDOFF',
          context: { ...conversation.context, handoffRequestedAt: new Date().toISOString() },
        })
        .where(eq(supportConversations.id, id));
      return { data: { conversationId: id, state: 'FOLLOW_UP_OR_HANDOFF' as const } };
    });
  }

  private async writeMutationEvent(
    principal: PublicPrincipal,
    conversationId: string,
    eventType: 'PUBLIC_CONVERSATION_STARTED' | 'PUBLIC_DRAFT_SAVED',
  ): Promise<void> {
    const mutationId = generateUuid();
    await this.drizzle.db.insert(outboxEvents).values({
      id: generateUuid(),
      mutationId,
      schemaVersion: 1,
      supportIntegrationId: principal.supportIntegrationId,
      actorType: 'EXTERNAL_REQUESTER',
      externalRequesterId: principal.externalRequesterId,
      aggregateType: 'SUPPORT_CONVERSATION',
      aggregateId: conversationId,
      eventType,
      deduplicationKey: `${eventType.toLowerCase()}:${mutationId}`,
      payload: { conversationId },
    });
  }
}

function normalizeDraft(dto: SavePublicTicketDraftDto): PublicTicketDraft {
  return {
    categoryId: dto.categoryId,
    title: dto.title.trim(),
    description: dto.description.trim(),
    impact: dto.impact,
    urgency: dto.urgency,
    ...(dto.customerAccountNumber ? { customerAccountNumber: dto.customerAccountNumber.trim() } : {}),
    ...(dto.serviceKey ? { serviceKey: dto.serviceKey.trim() } : {}),
  };
}

function parseDraft(value: unknown): PublicTicketDraft {
  if (!isRecord(value)) throw new BadRequestException('Le brouillon doit être complété avant confirmation.');
  const dto = Object.assign(new SavePublicTicketDraftDto(), value);
  const valid =
    typeof dto.categoryId === 'string' &&
    typeof dto.title === 'string' &&
    typeof dto.description === 'string' &&
    isLevel(dto.impact) &&
    isLevel(dto.urgency);
  if (!valid) throw new BadRequestException('Le brouillon enregistré est invalide.');
  return normalizeDraft(dto);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLevel(value: unknown): value is 'LOW' | 'MEDIUM' | 'HIGH' {
  return value === 'LOW' || value === 'MEDIUM' || value === 'HIGH';
}
