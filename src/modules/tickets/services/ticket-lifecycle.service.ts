import { ConflictException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import {
  categories,
  departments,
  externalRequesters,
  outboxEvents,
  supportIntegrations,
  tickets,
  users,
} from '../../../database/schemas';
import { TicketStateMachine, TicketStatus } from '../domain/ticket-status-transitions';
import { TicketPermissions } from '../domain/ticket-permissions';
import { TicketHistoryService } from './ticket-history.service';
import { MetricsService } from '../../../common/metrics/metrics.service';
import { SettingsService } from '../../settings/settings.service';
import { calculateSlaDueDate } from '../../../common/helpers/sla.helper';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { generateUuid } from '../../../common/helpers/uuidv7.helper';
import { internalActor } from '../domain/ticket-actor';
import {
  TicketCancelledEvent,
  TicketClosedEvent,
  TicketReopenedEvent,
  TicketResolvedEvent,
  TicketStatusChangedEvent,
} from '../domain/ticket.events';
import { toPublicTicketStatus } from '../domain/public-ticket-status';
import { TicketNotFoundException } from '../domain/exceptions/ticket-not-found.exception';
const creator = alias(users, 'ticket_creator');
const assignee = alias(users, 'ticket_assignee');
const assignedTeam = alias(departments, 'ticket_assigned_team');
function publicStatusEventType(status: TicketStatus) {
  if (status === 'PENDING_CUSTOMER') return 'PUBLIC_INFORMATION_REQUESTED' as const;
  if (status === 'RESOLVED') return 'PUBLIC_TICKET_RESOLVED' as const;
  if (status === 'CLOSED' || status === 'CANCELLED') return 'PUBLIC_TICKET_CLOSED' as const;
  if (status === 'REOPENED') return 'PUBLIC_TICKET_REOPENED' as const;
  return 'PUBLIC_STATUS_CHANGED' as const;
}
@Injectable()
export class TicketLifecycleService {
  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly stateMachine: TicketStateMachine,
    private readonly ticketPermissions: TicketPermissions,
    private readonly ticketHistory: TicketHistoryService,
    private readonly eventEmitter: EventEmitter2,
    private readonly metricsService: MetricsService,
    private readonly settingsService: SettingsService,
  ) {}
  async changeStatus(id: string, newStatus: TicketStatus, user: JwtPayload, reason?: string) {
    const ticket = await this.findTicketById(id);
    const oldStatus = ticket.status as TicketStatus;
    this.stateMachine.validateTransition(oldStatus, newStatus);
    this.ticketPermissions.checkCanChangeStatus(ticket, newStatus, user);
    const now = new Date();
    const updateFields = await this.buildSlaUpdateFields(ticket, oldStatus, newStatus, now, reason);
    await this.drizzle.runInTransaction(async () => {
      const [transitioned] = await this.drizzle.db
        .update(tickets)
        .set(updateFields)
        .where(and(eq(tickets.id, id), eq(tickets.status, oldStatus)))
        .returning({ id: tickets.id });
      if (!transitioned) throw new ConflictException('Le statut du ticket a changé. Rechargez avant de réessayer.');
      await this.ticketHistory.recordByActor(
        id,
        internalActor(user.sub),
        'STATUS_CHANGED',
        { status: oldStatus },
        { status: newStatus },
        { reason },
        ticket.supportIntegrationId ?? undefined,
      );
      if (ticket.supportIntegrationId && ticket.requesterId) {
        const mutationId = generateUuid();
        const eventType = publicStatusEventType(newStatus);
        await this.drizzle.db.insert(outboxEvents).values({
          id: generateUuid(),
          mutationId,
          schemaVersion: 1,
          supportIntegrationId: ticket.supportIntegrationId,
          actorType: 'INTERNAL',
          userId: user.sub,
          aggregateType: 'TICKET',
          aggregateId: id,
          eventType,
          deduplicationKey: `${eventType.toLowerCase()}:${mutationId}`,
          payload: { ticketId: id, status: toPublicTicketStatus(newStatus) },
        });
      }
    });
    this.emitAfterCommit(
      'ticket.status_changed',
      new TicketStatusChangedEvent(id, oldStatus, newStatus, user.sub, ticket.supportIntegrationId),
    );
    this.emitStatusEvent(newStatus, id, user.sub, ticket.supportIntegrationId);
    if (['RESOLVED', 'CLOSED', 'CANCELLED'].includes(newStatus)) this.metricsService.ticketsActive.dec();
    if (newStatus === 'REOPENED') this.metricsService.ticketsActive.inc();
    const updated = await this.findTicketById(id);
    return { message: `Statut changé : ${oldStatus} -> ${newStatus}`, data: updated };
  }
  private async buildSlaUpdateFields(
    ticket: {
      slaPausedAt: Date | null;
      accumulatedPauseMs: number;
      resolutionDueAt: Date | null;
      firstResponseAt: Date | null;
      priority: string;
    },
    oldStatus: string,
    newStatus: string,
    now: Date,
    reason?: string,
  ): Promise<Record<string, unknown>> {
    const fields: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'PENDING_CUSTOMER' || newStatus === 'PENDING_THIRD_PARTY') fields['slaPausedAt'] = now;
    if (
      (oldStatus === 'PENDING_CUSTOMER' || oldStatus === 'PENDING_THIRD_PARTY') &&
      (newStatus === 'ASSIGNED' || newStatus === 'IN_PROGRESS')
    ) {
      if (ticket.slaPausedAt) {
        const pauseDuration = now.getTime() - new Date(ticket.slaPausedAt).getTime();
        fields['accumulatedPauseMs'] = ticket.accumulatedPauseMs + pauseDuration;
        fields['slaPausedAt'] = null;
        if (ticket.resolutionDueAt)
          fields['resolutionDueAt'] = new Date(new Date(ticket.resolutionDueAt).getTime() + pauseDuration);
      }
    }
    if (newStatus === 'RESOLVED' || newStatus === 'CLOSED' || newStatus === 'CANCELLED') {
      if (ticket.slaPausedAt && (oldStatus === 'PENDING_CUSTOMER' || oldStatus === 'PENDING_THIRD_PARTY')) {
        const pauseDuration = now.getTime() - new Date(ticket.slaPausedAt).getTime();
        fields['accumulatedPauseMs'] = ticket.accumulatedPauseMs + pauseDuration;
        if (ticket.resolutionDueAt)
          fields['resolutionDueAt'] = new Date(new Date(ticket.resolutionDueAt).getTime() + pauseDuration);
      }
      fields['slaPausedAt'] = null;
    }
    if (newStatus === 'IN_PROGRESS' && !ticket.firstResponseAt) fields['firstResponseAt'] = now;
    if (newStatus === 'RESOLVED') {
      fields['resolvedAt'] = now;
      if (reason) fields['resolutionSummary'] = reason;
    }
    if (newStatus === 'CLOSED') fields['closedAt'] = now;
    if (newStatus === 'REOPENED') {
      fields['resolvedAt'] = null;
      fields['closedAt'] = null;
      const businessHours = await this.settingsService.getBusinessHours();
      const businessDays = await this.settingsService.getBusinessDays();
      const calendarType = ticket.priority === 'CRITICAL' || ticket.priority === 'HIGH' ? '24_7' : 'BUSINESS_HOURS';
      const reopenMinutes = Number(process.env['TICKET_REOPEN_SLA_MINUTES'] ?? 240);
      const safeMinutes = Number.isFinite(reopenMinutes) && reopenMinutes > 0 ? reopenMinutes : 240;
      fields['resolutionDueAt'] = calculateSlaDueDate(
        now,
        safeMinutes,
        calendarType as '24_7' | 'BUSINESS_HOURS',
        businessHours,
        businessDays,
      );
    }
    return fields;
  }
  private emitStatusEvent(
    newStatus: TicketStatus,
    id: string,
    userId: string,
    supportIntegrationId: string | null,
  ): void {
    switch (newStatus) {
      case 'RESOLVED':
        this.emitAfterCommit('ticket.resolved', new TicketResolvedEvent(id, userId, supportIntegrationId));
        break;
      case 'CLOSED':
        this.emitAfterCommit('ticket.closed', new TicketClosedEvent(id, userId, supportIntegrationId));
        break;
      case 'REOPENED':
        this.emitAfterCommit('ticket.reopened', new TicketReopenedEvent(id, userId, supportIntegrationId));
        break;
      case 'CANCELLED':
        this.emitAfterCommit('ticket.cancelled', new TicketCancelledEvent(id, userId, supportIntegrationId));
        break;
    }
  }
  private emitAfterCommit(event: string, payload: object): void {
    const effect = () => {
      this.eventEmitter.emit(event, payload);
    };
    if (typeof this.drizzle.afterCommit === 'function') this.drizzle.afterCommit(effect);
    else effect();
  }
  private async findTicketById(id: string) {
    const result = await this.drizzle.db
      .select({
        id: tickets.id,
        ticketNumber: tickets.ticketNumber,
        title: tickets.title,
        description: tickets.description,
        status: tickets.status,
        priority: tickets.priority,
        severity: tickets.severity,
        categoryId: tickets.categoryId,
        categoryName: categories.name,
        slaPolicyId: tickets.slaPolicyId,
        customerAccountNumber: tickets.customerAccountNumber,
        customerName: tickets.customerName,
        customerContact: tickets.customerContact,
        departmentId: tickets.departmentId,
        assignedTeamId: tickets.assignedTeamId,
        createdBy: tickets.createdBy,
        openedByUserId: tickets.openedByUserId,
        requesterId: tickets.requesterId,
        supportIntegrationId: tickets.supportIntegrationId,
        sourceChannel: tickets.sourceChannel,
        requesterName: externalRequesters.displayName,
        integrationName: supportIntegrations.name,
        assignedTo: tickets.assignedTo,
        resolutionSummary: tickets.resolutionSummary,
        firstResponseAt: tickets.firstResponseAt,
        firstResponseDueAt: tickets.firstResponseDueAt,
        resolutionDueAt: tickets.resolutionDueAt,
        resolvedAt: tickets.resolvedAt,
        closedAt: tickets.closedAt,
        tags: tickets.tags,
        metadata: tickets.metadata,
        slaPausedAt: tickets.slaPausedAt,
        accumulatedPauseMs: tickets.accumulatedPauseMs,
        slaBreached: tickets.slaBreached,
        createdAt: tickets.createdAt,
        updatedAt: tickets.updatedAt,
        creatorName: sql<string>`concat(${creator.firstName}, ' ', ${creator.lastName})`,
        assigneeName: sql<string>`concat(${assignee.firstName}, ' ', ${assignee.lastName})`,
        departmentName: departments.name,
        assignedTeamName: assignedTeam.name,
      })
      .from(tickets)
      .leftJoin(creator, eq(tickets.createdBy, creator.id))
      .leftJoin(assignee, eq(tickets.assignedTo, assignee.id))
      .leftJoin(departments, eq(tickets.departmentId, departments.id))
      .leftJoin(assignedTeam, eq(tickets.assignedTeamId, assignedTeam.id))
      .leftJoin(categories, eq(tickets.categoryId, categories.id))
      .leftJoin(externalRequesters, eq(tickets.requesterId, externalRequesters.id))
      .leftJoin(supportIntegrations, eq(tickets.supportIntegrationId, supportIntegrations.id))
      .where(and(eq(tickets.id, id), isNull(tickets.deletedAt)))
      .limit(1);
    if (!result[0]) throw new TicketNotFoundException(id);
    if (result[0].createdBy && !result[0].openedByUserId)
      this.metricsService.legacyTicketActorFallbackTotal.inc({ surface: 'ticket_detail' });
    return result[0];
  }
}
