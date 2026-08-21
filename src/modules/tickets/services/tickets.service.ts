import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { generateUuid } from '../../../common/helpers/uuidv7.helper';
import { CreateTicketInput, UpdateTicketInput } from '../dto/ticket-service.interfaces';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { categories, departments, externalRequesters, outboxEvents, slaPolicies, supportIntegrations, tickets, users } from '../../../database/schemas';
import { TicketNumberService } from './ticket-number.service';
import { TicketHistoryService } from './ticket-history.service';
import { TicketNotFoundException } from '../domain/exceptions/ticket-not-found.exception';
import { MetricsService } from '../../../common/metrics/metrics.service';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { SettingsService } from '../../settings/settings.service';
import { calculateSlaDueDate } from '../../../common/helpers/sla.helper';
import { TicketCreatedEvent } from '../domain/ticket.events';
import { internalActor, toTicketActorColumns } from '../domain/ticket-actor';
import { TicketCreationCommand, TicketRequesterContext } from '../domain/ticket-creation-command';
import { TicketStatus } from '../domain/ticket-status-transitions';
import { TicketLifecycleService } from './ticket-lifecycle.service';
import { TicketAssignmentService } from './ticket-assignment.service';
const creator = alias(users, 'ticket_creator');
const assignee = alias(users, 'ticket_assignee');
const assignedTeam = alias(departments, 'ticket_assigned_team');
@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);
  constructor(
    private readonly drizzle: DrizzleProvider, private readonly ticketNumber: TicketNumberService,
    private readonly ticketHistory: TicketHistoryService, private readonly eventEmitter: EventEmitter2,
    private readonly metricsService: MetricsService, private readonly settingsService: SettingsService,
    private readonly lifecycle: TicketLifecycleService, private readonly assignment: TicketAssignmentService,
  ) {}
  async create(dto: CreateTicketInput, createdBy: string) {
    return this.createFromCommand({ input: dto, actor: internalActor(createdBy), outboxEvents: [] });
  }
  async createFromCommand(command: TicketCreationCommand) {
    const dto = command.input;
    const [policy] = await this.drizzle.db.select().from(slaPolicies).where(and(eq(slaPolicies.categoryId, dto.categoryId), eq(slaPolicies.priority, dto.priority as typeof slaPolicies.$inferSelect.priority))).limit(1);
    if (!policy) throw new BadRequestException('Aucune politique SLA trouvée pour cette catégorie et cette priorité. Vérifiez les politiques SLA disponibles.');
    const [cat] = await this.drizzle.db.select().from(categories).where(eq(categories.id, dto.categoryId)).limit(1);
    const categoryName = cat?.name || 'UNKNOWN';
    const ticketNumber = await this.ticketNumber.generate();
    const id = generateUuid();
    const now = new Date();
    const calendarType = dto.priority === 'CRITICAL' || dto.priority === 'HIGH' ? '24_7' : 'BUSINESS_HOURS';
    const businessHours = await this.settingsService.getBusinessHours();
    const businessDays = await this.settingsService.getBusinessDays();
    const firstResponseDueAt = calculateSlaDueDate(now, policy.firstResponseMinutes, calendarType, businessHours, businessDays);
    const resolutionDueAt = calculateSlaDueDate(now, policy.resolutionMinutes, calendarType, businessHours, businessDays);
    const requester = this.resolveRequesterContext(command);
    const actorColumns = toTicketActorColumns(command.actor, requester?.supportIntegrationId);
    const created = await this.drizzle.runInTransaction(async () => {
      await this.drizzle.db.insert(tickets).values({
        id, ticketNumber, title: dto.title, description: dto.description, status: 'NEW' as const,
        priority: dto.priority as typeof tickets.$inferSelect.priority, severity: dto.severity as typeof tickets.$inferSelect.severity,
        categoryId: dto.categoryId, slaPolicyId: policy.id, customerAccountNumber: dto.customerAccountNumber || null,
        customerName: dto.customerName || null, customerContact: dto.customerContact || null,
        departmentId: dto.departmentId, assignedTeamId: dto.assignedTeamId, createdBy: actorColumns.userId,
        openedByUserId: actorColumns.userId, requesterId: requester?.requesterId ?? null,
        supportIntegrationId: requester?.supportIntegrationId ?? null, sourceChannel: command.sourceChannel ?? 'INTERNAL',
        tags: dto.tags || null, firstResponseDueAt, resolutionDueAt,
      });
      const persisted = await this.findTicketById(id);
      await this.ticketHistory.recordByActor(id, command.actor, 'TICKET_CREATED', null, { ticketNumber, title: dto.title }, undefined, requester?.supportIntegrationId);
      for (const event of command.outboxEvents ?? []) {
        await this.drizzle.db.insert(outboxEvents).values({
          id: generateUuid(), mutationId: event.mutationId, schemaVersion: event.schemaVersion,
          supportIntegrationId: requester?.supportIntegrationId ?? null, actorType: actorColumns.actorType, userId: actorColumns.userId,
          externalRequesterId: actorColumns.externalRequesterId, aggregateType: 'TICKET', aggregateId: id,
          eventType: event.eventType, deduplicationKey: event.deduplicationKey, payload: { ...event.payload },
        });
      }
      this.emitAfterCommit('ticket.created', new TicketCreatedEvent(persisted, command.actor));
      this.drizzle.afterCommit(() => {
        this.metricsService.ticketsCreatedTotal.inc({ priority: dto.priority, category: categoryName });
        this.metricsService.ticketsActive.inc();
        this.logger.log(`Ticket créé: ${ticketNumber} (${id}) par ${command.actor.type}`);
      });
      return persisted;
    });
    return { message: 'Ticket créé avec succès.', data: created };
  }
  async findById(id: string) {
    const ticket = await this.findTicketById(id);
    return { data: ticket };
  }
  async update(id: string, dto: UpdateTicketInput, user: JwtPayload) {
    return this.assignment.update(id, dto, user);
  }
  async changeStatus(id: string, newStatus: TicketStatus, user: JwtPayload, reason?: string) {
    return this.lifecycle.changeStatus(id, newStatus, user, reason);
  }
  async assign(id: string, toUserId: string, user: JwtPayload, reason?: string) {
    return this.assignment.assign(id, toUserId, user, reason);
  }
  async escalate(id: string, toUserId: string, toDepartmentId: string, user: JwtPayload, reason?: string) {
    return this.assignment.escalate(id, toUserId, toDepartmentId, user, reason);
  }
  async softDelete(id: string) {
    const ticket = await this.findTicketById(id);
    await this.drizzle.db.update(tickets).set({ deletedAt: new Date() }).where(eq(tickets.id, id));
    this.logger.log(`Ticket ${ticket.ticketNumber} supprimé (soft delete)`);
  }
  async getHistory(id: string) {
    await this.findTicketById(id);
    return this.ticketHistory.getHistory(id);
  }
  private resolveRequesterContext(command: TicketCreationCommand): TicketRequesterContext | undefined {
    if (command.actor.type === 'EXTERNAL_REQUESTER') {
      const ctx = { requesterId: command.actor.externalRequesterId, supportIntegrationId: command.actor.supportIntegrationId };
      if (command.requester && (command.requester.requesterId !== ctx.requesterId || command.requester.supportIntegrationId !== ctx.supportIntegrationId)) throw new BadRequestException("Le demandeur ne correspond pas à l'acteur externe.");
      if (!command.sourceChannel || command.sourceChannel === 'INTERNAL') throw new BadRequestException('Un canal public explicite est requis pour un demandeur externe.');
      return ctx;
    }
    if (command.actor.type === 'SYSTEM' && !command.requester) throw new BadRequestException('Une création système doit cibler un demandeur externe.');
    return command.requester;
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
