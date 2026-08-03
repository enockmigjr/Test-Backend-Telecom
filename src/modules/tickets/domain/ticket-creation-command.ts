import { CreateTicketInput } from '../dto/ticket-service.interfaces';
import { TicketActor } from './ticket-actor';

export type TicketOutboxEventType =
  | 'TICKET_CREATED'
  | 'PUBLIC_TICKET_CREATED'
  | 'PUBLIC_REPLY_CREATED'
  | 'PUBLIC_REPLY_CORRECTED'
  | 'PUBLIC_REQUESTER_COMMENT_CREATED'
  | 'PUBLIC_CONVERSATION_STARTED'
  | 'PUBLIC_DRAFT_SAVED'
  | 'PUBLIC_PREFERENCES_UPDATED'
  | 'PUBLIC_ATTACHMENT_QUARANTINED'
  | 'PUBLIC_INFORMATION_REQUESTED'
  | 'PUBLIC_STATUS_CHANGED'
  | 'PUBLIC_TICKET_RESOLVED'
  | 'PUBLIC_TICKET_CLOSED'
  | 'PUBLIC_TICKET_REOPENED'
  | 'PUBLIC_HUMAN_HANDOFF_REQUESTED';

export interface TicketOutboxWrite {
  readonly mutationId: string;
  readonly schemaVersion: 1;
  readonly eventType: TicketOutboxEventType;
  readonly deduplicationKey: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface TicketRequesterContext {
  readonly requesterId: string;
  readonly supportIntegrationId: string;
}

/** Commande commune aux créations internes et aux futurs adaptateurs publics. */
export interface TicketCreationCommand {
  readonly input: CreateTicketInput;
  readonly actor: TicketActor;
  readonly requester?: TicketRequesterContext;
  readonly sourceChannel?: 'INTERNAL' | 'WEB_PORTAL' | 'WIDGET' | 'WORDPRESS' | 'EMAIL' | 'WHATSAPP' | 'API';
  readonly outboxEvents?: readonly TicketOutboxWrite[];
}
