import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { categories, departments, externalRequesters, slaPolicies, supportIntegrations, ticketAssignments, tickets, users } from '../../../database/schemas';
import { TicketStateMachine, TicketStatus } from '../domain/ticket-status-transitions';
import { TicketPermissions } from '../domain/ticket-permissions';
import { TicketHistoryService } from './ticket-history.service';
import { TicketAssignmentTargetService } from './ticket-assignment-target.service';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { generateUuid } from '../../../common/helpers/uuidv7.helper';
import { internalActor } from '../domain/ticket-actor';
import { TicketAssignedEvent, TicketEscalatedEvent } from '../domain/ticket.events';
import { TicketNotFoundException } from '../domain/exceptions/ticket-not-found.exception';
import { MetricsService } from '../../../common/metrics/metrics.service';
import { SettingsService } from '../../settings/settings.service';
import { calculateSlaDueDate } from '../../../common/helpers/sla.helper';
import { UpdateTicketInput } from '../dto/ticket-service.interfaces';
const creator = alias(users, 'ticket_creator');
const assignee = alias(users, 'ticket_assignee');
const assignedTeam = alias(departments, 'ticket_assigned_team');
@Injectable()
export class TicketAssignmentService {
  private readonly logger = new Logger(TicketAssignmentService.name);
  constructor(
    private readonly drizzle: DrizzleProvider, private readonly stateMachine: TicketStateMachine,
    private readonly ticketPermissions: TicketPermissions, private readonly ticketHistory: TicketHistoryService,
    private readonly assignmentTarget: TicketAssignmentTargetService, private readonly eventEmitter: EventEmitter2,
    private readonly metricsService: MetricsService, private readonly settingsService: SettingsService,
  ) {}
  async update(id: string, dto: UpdateTicketInput, user: JwtPayload) {
    const ticket = await this.findTicketById(id);
    const updatedFields = Object.keys(dto).filter((k) => dto[k as keyof typeof dto] !== undefined);
    this.ticketPermissions.checkCanUpdateFields(ticket, user, updatedFields);
    const updateData: Record<string, unknown> = {};
    if (dto.title !== undefined) updateData['title'] = dto.title;
    if (dto.description !== undefined) updateData['description'] = dto.description;
    if (dto.priority !== undefined) updateData['priority'] = dto.priority;
    if (dto.severity !== undefined) updateData['severity'] = dto.severity;
    if (dto.categoryId !== undefined) updateData['categoryId'] = dto.categoryId;
    if (dto.tags !== undefined) updateData['tags'] = dto.tags;
    if (Object.keys(updateData).length === 0) return { message: 'Aucune modification.', data: ticket };
    if (dto.priority !== undefined || dto.categoryId !== undefined) {
      const categoryId = (dto.categoryId as string) ?? ticket.categoryId;
      const priority = (dto.priority as string) ?? ticket.priority;
      const [policy] = await this.drizzle.db.select().from(slaPolicies).where(and(eq(slaPolicies.categoryId, categoryId), eq(slaPolicies.priority, priority as typeof slaPolicies.$inferSelect.priority))).limit(1);
      if (policy) {
        const now = new Date(); const cal = priority === 'CRITICAL' || priority === 'HIGH' ? '24_7' : 'BUSINESS_HOURS';
        const bh = await this.settingsService.getBusinessHours(); const bd = await this.settingsService.getBusinessDays();
        updateData['slaPolicyId'] = policy.id;
        updateData['firstResponseDueAt'] = calculateSlaDueDate(now, policy.firstResponseMinutes, cal as '24_7' | 'BUSINESS_HOURS', bh, bd);
        updateData['resolutionDueAt'] = calculateSlaDueDate(now, policy.resolutionMinutes, cal as '24_7' | 'BUSINESS_HOURS', bh, bd);
      }
    }
    return this.drizzle.runInTransaction(async () => {
      await this.drizzle.db.update(tickets).set(updateData).where(and(eq(tickets.id, id), isNull(tickets.deletedAt)));
      await this.ticketHistory.recordByActor(id, internalActor(user.sub), 'UPDATED', ticket, updateData, undefined, ticket.supportIntegrationId ?? undefined);
      const updated = await this.findTicketById(id);
      return { message: 'Ticket mis à jour avec succès.', data: updated };
    });
  }
  async assign(id: string, toUserId: string, user: JwtPayload, reason?: string) {
    const ticket = await this.findTicketById(id);
    const { isAutoAssign } = this.ticketPermissions.checkCanAssign(ticket, toUserId, user);
    await this.assignmentTarget.assertEligible(toUserId, ticket.assignedTeamId);
    const newStatus = isAutoAssign ? 'ASSIGNED' : ticket.status === 'NEW' ? 'ASSIGNED' : ticket.status;
    if (ticket.status === 'NEW') this.stateMachine.validateTransition(ticket.status as TicketStatus, newStatus as TicketStatus);
    return this.drizzle.runInTransaction(async () => {
      const [updatedRow] = await this.drizzle.db.update(tickets).set({ assignedTo: toUserId, status: newStatus as typeof tickets.$inferSelect.status }).where(and(eq(tickets.id, id), eq(tickets.status, ticket.status), isNull(tickets.deletedAt))).returning({ id: tickets.id });
      if (!updatedRow) throw new ConflictException('Le ticket a été modifié concurremment. Rechargez avant de réessayer.');
      await this.drizzle.db.insert(ticketAssignments).values({ id: generateUuid(), ticketId: id, fromUserId: ticket.assignedTo || null, toUserId, fromDepartmentId: ticket.assignedTeamId || null, toDepartmentId: ticket.assignedTeamId, assignedBy: user.sub, actorType: 'INTERNAL', reason: reason || null });
      await this.ticketHistory.recordByActor(id, internalActor(user.sub), 'ASSIGNED', { assignedTo: ticket.assignedTo, status: ticket.status }, { assignedTo: toUserId, status: newStatus }, { reason }, ticket.supportIntegrationId ?? undefined);
      this.emitAfterCommit('ticket.assigned', new TicketAssignedEvent(id, toUserId, user.sub, ticket.supportIntegrationId));
      this.logger.log(`Ticket ${ticket.ticketNumber} assigné à ${toUserId} par ${user.sub} (auto: ${isAutoAssign})`);
      const updated = await this.findTicketById(id);
      return { message: isAutoAssign ? 'Ticket auto-assigné avec succès.' : 'Ticket assigné avec succès.', data: updated };
    });
  }
  async escalate(id: string, toUserId: string, toDepartmentId: string, user: JwtPayload, reason?: string) {
    const ticket = await this.findTicketById(id);
    const { isHierarchical } = this.ticketPermissions.checkCanEscalate(ticket, toDepartmentId, user);
    await this.assignmentTarget.assertEligible(toUserId, toDepartmentId);
    return this.drizzle.runInTransaction(async () => {
      const [updatedRow] = await this.drizzle.db.update(tickets).set({ assignedTo: toUserId, assignedTeamId: toDepartmentId }).where(and(eq(tickets.id, id), eq(tickets.status, ticket.status), isNull(tickets.deletedAt))).returning({ id: tickets.id });
      if (!updatedRow) throw new ConflictException('Le ticket a été modifié concurremment. Rechargez avant de réessayer.');
      await this.drizzle.db.insert(ticketAssignments).values({ id: generateUuid(), ticketId: id, fromUserId: ticket.assignedTo || null, toUserId, fromDepartmentId: ticket.assignedTeamId || null, toDepartmentId, assignedBy: user.sub, actorType: 'INTERNAL', reason: reason || null });
      await this.ticketHistory.recordByActor(id, internalActor(user.sub), 'ESCALATED', { assignedTo: ticket.assignedTo, assignedTeamId: ticket.assignedTeamId }, { assignedTo: toUserId, assignedTeamId: toDepartmentId }, { reason, type: isHierarchical ? 'hierarchical' : 'functional' }, ticket.supportIntegrationId ?? undefined);
      this.emitAfterCommit('ticket.escalated', new TicketEscalatedEvent(id, toUserId, user.sub, ticket.supportIntegrationId));
      this.logger.log(`Ticket ${ticket.ticketNumber} escaladé par ${user.sub} (type: ${isHierarchical ? 'hierarchical' : 'functional'})`);
      const updated = await this.findTicketById(id);
      return { message: `Ticket escaladé avec succès (${isHierarchical ? 'hiérarchique' : 'fonctionnelle'}).`, data: updated };
    });
  }
  private emitAfterCommit(event: string, payload: object): void {
    const effect = () => { this.eventEmitter.emit(event, payload); };
    if (typeof this.drizzle.afterCommit === 'function') this.drizzle.afterCommit(effect); else effect();
  }
  private async findTicketById(id: string) {
    const result = await this.drizzle.db.select({
      id: tickets.id, ticketNumber: tickets.ticketNumber, title: tickets.title, description: tickets.description, status: tickets.status, priority: tickets.priority, severity: tickets.severity, categoryId: tickets.categoryId, categoryName: categories.name, slaPolicyId: tickets.slaPolicyId,
      customerAccountNumber: tickets.customerAccountNumber, customerName: tickets.customerName, customerContact: tickets.customerContact, departmentId: tickets.departmentId, assignedTeamId: tickets.assignedTeamId, createdBy: tickets.createdBy, openedByUserId: tickets.openedByUserId, requesterId: tickets.requesterId, supportIntegrationId: tickets.supportIntegrationId, sourceChannel: tickets.sourceChannel,
      requesterName: externalRequesters.displayName, integrationName: supportIntegrations.name, assignedTo: tickets.assignedTo, resolutionSummary: tickets.resolutionSummary, firstResponseAt: tickets.firstResponseAt, firstResponseDueAt: tickets.firstResponseDueAt, resolutionDueAt: tickets.resolutionDueAt, resolvedAt: tickets.resolvedAt, closedAt: tickets.closedAt, tags: tickets.tags, metadata: tickets.metadata, slaPausedAt: tickets.slaPausedAt, accumulatedPauseMs: tickets.accumulatedPauseMs, slaBreached: tickets.slaBreached, createdAt: tickets.createdAt, updatedAt: tickets.updatedAt,
      creatorName: sql<string>`concat(${creator.firstName}, ' ', ${creator.lastName})`, assigneeName: sql<string>`concat(${assignee.firstName}, ' ', ${assignee.lastName})`, departmentName: departments.name, assignedTeamName: assignedTeam.name,
    }).from(tickets).leftJoin(creator, eq(tickets.createdBy, creator.id)).leftJoin(assignee, eq(tickets.assignedTo, assignee.id)).leftJoin(departments, eq(tickets.departmentId, departments.id)).leftJoin(assignedTeam, eq(tickets.assignedTeamId, assignedTeam.id)).leftJoin(categories, eq(tickets.categoryId, categories.id)).leftJoin(externalRequesters, eq(tickets.requesterId, externalRequesters.id)).leftJoin(supportIntegrations, eq(tickets.supportIntegrationId, supportIntegrations.id)).where(and(eq(tickets.id, id), isNull(tickets.deletedAt))).limit(1);
    if (!result[0]) throw new TicketNotFoundException(id);
    if (result[0].createdBy && !result[0].openedByUserId) this.metricsService.legacyTicketActorFallbackTotal.inc({ surface: 'ticket_detail' });
    return result[0];
  }
}
