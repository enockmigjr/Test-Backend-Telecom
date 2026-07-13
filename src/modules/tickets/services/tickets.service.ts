import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq, and, isNull, sql, count } from 'drizzle-orm';
import { generateUuid } from '../../../common/helpers/uuidv7.helper';
import { CreateTicketInput, UpdateTicketInput } from '../dto/ticket-service.interfaces';

import { DrizzleProvider } from '../../../database/drizzle.provider';
import {
  tickets,
  ticketAssignments,
  slaPolicies,
  users,
  departments,
  ticketComments,
  categories,
} from '../../../database/schemas';
import { TicketStateMachine, TicketStatus } from '../domain/ticket-status-transitions';
import { TicketPermissions } from '../domain/ticket-permissions';
import { TicketNumberService } from './ticket-number.service';
import { TicketHistoryService } from './ticket-history.service';
import { TicketNotFoundException } from '../domain/exceptions/ticket-not-found.exception';
import { MetricsService } from '../../../common/metrics/metrics.service';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { SettingsService } from '../../settings/settings.service';
import { calculateSlaDueDate } from '../../../common/helpers/sla.helper';
import {
  TicketCreatedEvent,
  TicketStatusChangedEvent,
  TicketAssignedEvent,
  TicketEscalatedEvent,
  TicketResolvedEvent,
  TicketClosedEvent,
  TicketReopenedEvent,
  TicketCancelledEvent,
} from '../domain/ticket.events';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly stateMachine: TicketStateMachine,
    private readonly ticketPermissions: TicketPermissions,
    private readonly ticketNumber: TicketNumberService,
    private readonly ticketHistory: TicketHistoryService,
    private readonly eventEmitter: EventEmitter2,
    private readonly metricsService: MetricsService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Crée un nouveau ticket d'incident.
   */
  async create(dto: CreateTicketInput, createdBy: string) {
    // Trouver la politique SLA correspondante
    const [policy] = await this.drizzle.db
      .select()
      .from(slaPolicies)
      .where(
        and(
          eq(slaPolicies.categoryId, dto.categoryId),
          eq(slaPolicies.priority, dto.priority as typeof slaPolicies.$inferSelect.priority),
        ),
      )
      .limit(1);

    if (!policy) {
      throw new BadRequestException(
        `Aucune politique SLA trouvee pour cette categorie et cette priorite. Verifiez les politiques SLA disponibles.`,
      );
    }

    const [cat] = await this.drizzle.db.select().from(categories).where(eq(categories.id, dto.categoryId)).limit(1);
    const categoryName = cat?.name || 'UNKNOWN';

    const ticketNumber = await this.ticketNumber.generate();
    const id = generateUuid();
    const now = new Date();

    // Le premier contact commence dès la création (START)
    const calendarType = dto.priority === 'CRITICAL' || dto.priority === 'HIGH' ? '24_7' : 'BUSINESS_HOURS';
    const businessHours = await this.settingsService.getBusinessHours();
    const businessDays = await this.settingsService.getBusinessDays();
    const firstResponseDueAt = calculateSlaDueDate(
      now,
      policy.firstResponseMinutes,
      calendarType,
      businessHours,
      businessDays,
    );

    // Le SLA de résolution ne démarre qu'au passage en statut ASSIGNED/IN_PROGRESS.
    // On initialise ici resolutionDueAt de façon lâche à 7 jours par défaut.
    const resolutionDueAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    await this.drizzle.db.insert(tickets).values({
      id,
      ticketNumber,
      title: dto.title,
      description: dto.description,
      status: 'NEW' as const,
      priority: dto.priority as typeof tickets.$inferSelect.priority,
      severity: dto.severity as typeof tickets.$inferSelect.severity,
      categoryId: dto.categoryId,
      slaPolicyId: policy.id,
      customerAccountNumber: dto.customerAccountNumber || null,
      customerName: dto.customerName || null,
      customerContact: dto.customerContact || null,
      departmentId: dto.departmentId,
      assignedTeamId: dto.assignedTeamId,
      createdBy,
      tags: dto.tags || null,
      firstResponseDueAt,
      resolutionDueAt,
    });

    const created = await this.findTicketById(id);

    // Enregistrer dans l'historique
    await this.ticketHistory.record(id, createdBy, 'TICKET_CREATED', null, { ticketNumber, title: dto.title });

    // Émettre l'événement de domaine
    this.eventEmitter.emit('ticket.created', new TicketCreatedEvent(created, createdBy));

    // Métriques Prometheus
    this.metricsService.ticketsCreatedTotal.inc({ priority: dto.priority, category: categoryName });
    this.metricsService.ticketsActive.inc();

    this.logger.log(`Ticket créé: ${ticketNumber} (${id}) par ${createdBy}`);

    return { message: 'Ticket créé avec succès.', data: created };
  }

  /**
   * Récupère un ticket par son ID.
   */
  async findById(id: string) {
    const ticket = await this.findTicketById(id);
    return { data: ticket };
  }

  /**
   * Récupère un ticket avec toutes les relations enrichies.
   */
  async findByIdDetailed(id: string) {
    const ticket = await this.findTicketById(id);

    const [commentCount] = await this.drizzle.db
      .select({ count: count() })
      .from(ticketComments)
      .where(eq(ticketComments.ticketId, id));

    // Historique des assignations
    const assignments = await this.drizzle.db
      .select({
        id: ticketAssignments.id,
        toUserId: ticketAssignments.toUserId,
        fromUserId: ticketAssignments.fromUserId,
        reason: ticketAssignments.reason,
        createdAt: ticketAssignments.createdAt,
      })
      .from(ticketAssignments)
      .where(eq(ticketAssignments.ticketId, id))
      .orderBy(sql`${ticketAssignments.createdAt} asc`)
      .limit(20);

    return {
      data: {
        ...ticket,
        _meta: {
          commentCount: Number(commentCount?.count ?? 0),
          assignmentCount: assignments.length,
        },
        assignmentHistory: assignments,
      },
    };
  }

  /**
   * Met à jour les informations d'un ticket avec validation fine (ownership-based).
   */
  async update(id: string, dto: UpdateTicketInput, user: JwtPayload) {
    const ticket = await this.findTicketById(id);

    // Déterminer quels champs sont modifiés pour valider les permissions correspondantes
    const updatedFields = Object.keys(dto).filter((key) => dto[key as keyof typeof dto] !== undefined);
    this.ticketPermissions.checkCanUpdateFields(ticket, user, updatedFields);

    const updateData: Record<string, unknown> = {};
    if (dto.title !== undefined) updateData['title'] = dto.title;
    if (dto.description !== undefined) updateData['description'] = dto.description;
    if (dto.priority !== undefined) updateData['priority'] = dto.priority;
    if (dto.severity !== undefined) updateData['severity'] = dto.severity;
    if (dto.categoryId !== undefined) updateData['categoryId'] = dto.categoryId;
    if (dto.tags !== undefined) updateData['tags'] = dto.tags;

    await this.drizzle.db.update(tickets).set(updateData).where(eq(tickets.id, id));

    await this.ticketHistory.record(id, user.sub, 'UPDATED', ticket, updateData);

    const updated = await this.findTicketById(id);
    return { message: 'Ticket mis à jour avec succès.', data: updated };
  }

  /**
   * Change le statut d'un ticket en validant la transition de statut ET la permission (ownership-based).
   */
  async changeStatus(id: string, newStatus: TicketStatus, user: JwtPayload, reason?: string) {
    const ticket = await this.findTicketById(id);
    const oldStatus = ticket.status as TicketStatus;

    // 1. Valider la transition de la state machine
    this.stateMachine.validateTransition(oldStatus, newStatus);

    // 2. Valider les permissions via TicketPermissions (point unique de vérité)
    this.ticketPermissions.checkCanChangeStatus(ticket, newStatus, user);

    const now = new Date();
    const updateFields = await this.buildSlaUpdateFields(ticket, oldStatus, newStatus, now, reason);

    await this.drizzle.db.update(tickets).set(updateFields).where(eq(tickets.id, id));
    await this.ticketHistory.record(
      id,
      user.sub,
      'STATUS_CHANGED',
      { status: oldStatus },
      { status: newStatus },
      { reason },
    );

    // Émettre l'événement de changement de statut
    this.eventEmitter.emit('ticket.status_changed', new TicketStatusChangedEvent(id, oldStatus, newStatus, user.sub));

    // Émettre des événements spécifiques
    this.emitStatusEvent(newStatus, id, user.sub);

    // Métriques Prometheus — décrémenter les tickets actifs si terminé
    if (['RESOLVED', 'CLOSED', 'CANCELLED'].includes(newStatus)) {
      this.metricsService.ticketsActive.dec();
    }
    // Incrémenter si réouvert
    if (newStatus === 'REOPENED') {
      this.metricsService.ticketsActive.inc();
    }

    const updated = await this.findTicketById(id);
    return { message: `Statut change : ${oldStatus} -> ${newStatus}`, data: updated };
  }

  /**
   * Assigne ou réassigne un ticket à un agent avec validation fine (ownership-based).
   */
  async assign(id: string, toUserId: string, user: JwtPayload, reason?: string) {
    const ticket = await this.findTicketById(id);

    // 1. Valider la permission d'assignation
    const { isAutoAssign } = this.ticketPermissions.checkCanAssign(ticket, toUserId, user);

    // 2. Créer l'entrée d'assignation
    await this.drizzle.db.insert(ticketAssignments).values({
      id: generateUuid(),
      ticketId: id,
      fromUserId: ticket.assignedTo || null,
      toUserId,
      fromDepartmentId: ticket.assignedTeamId || null,
      toDepartmentId: ticket.assignedTeamId,
      assignedBy: user.sub,
      reason: reason || null,
    });

    // 3. Mettre à jour le ticket
    // Si c'est un s'auto-assigner de ticket NEW, on fait automatiquement la transition vers ASSIGNED
    const newStatus = isAutoAssign ? 'ASSIGNED' : ticket.status === 'NEW' ? 'ASSIGNED' : ticket.status;
    await this.drizzle.db
      .update(tickets)
      .set({ assignedTo: toUserId, status: newStatus as typeof tickets.$inferSelect.status })
      .where(eq(tickets.id, id));

    await this.ticketHistory.record(
      id,
      user.sub,
      'ASSIGNED',
      { assignedTo: ticket.assignedTo, status: ticket.status },
      { assignedTo: toUserId, status: newStatus },
      { reason },
    );

    this.eventEmitter.emit('ticket.assigned', new TicketAssignedEvent(id, toUserId, user.sub));
    this.logger.log(`Ticket ${ticket.ticketNumber} assigne a ${toUserId} par ${user.sub} (auto: ${isAutoAssign})`);

    const updated = await this.findTicketById(id);
    return {
      message: isAutoAssign ? 'Ticket auto-assigne avec succes.' : 'Ticket assigne avec succes.',
      data: updated,
    };
  }

  /**
   * Escalade un ticket vers un autre agent/département avec validation fine (ownership-based).
   */
  async escalate(id: string, toUserId: string, toDepartmentId: string, user: JwtPayload, reason?: string) {
    const ticket = await this.findTicketById(id);

    // 1. Valider la permission d'escalade
    const { isHierarchical } = this.ticketPermissions.checkCanEscalate(ticket, toDepartmentId, user);

    await this.drizzle.db.insert(ticketAssignments).values({
      id: generateUuid(),
      ticketId: id,
      fromUserId: ticket.assignedTo || null,
      toUserId,
      fromDepartmentId: ticket.assignedTeamId || null,
      toDepartmentId,
      assignedBy: user.sub,
      reason: reason || null,
    });

    await this.drizzle.db
      .update(tickets)
      .set({ assignedTo: toUserId, assignedTeamId: toDepartmentId })
      .where(eq(tickets.id, id));

    await this.ticketHistory.record(
      id,
      user.sub,
      'ESCALATED',
      { assignedTo: ticket.assignedTo, assignedTeamId: ticket.assignedTeamId },
      { assignedTo: toUserId, assignedTeamId: toDepartmentId },
      { reason, type: isHierarchical ? 'hierarchical' : 'functional' },
    );

    this.eventEmitter.emit('ticket.escalated', new TicketEscalatedEvent(id, toUserId, user.sub));
    this.logger.log(
      `Ticket ${ticket.ticketNumber} escalade par ${user.sub} (type: ${isHierarchical ? 'hierarchical' : 'functional'})`,
    );

    const updated = await this.findTicketById(id);
    return {
      message: `Ticket escalade avec succes (${isHierarchical ? 'hierarchique' : 'fonctionnelle'}).`,
      data: updated,
    };
  }

  /**
   * Suppression logique (soft delete).
   */
  async softDelete(id: string) {
    const ticket = await this.findTicketById(id);
    await this.drizzle.db.update(tickets).set({ deletedAt: new Date() }).where(eq(tickets.id, id));

    this.logger.log(`Ticket ${ticket.ticketNumber} supprime (soft delete)`);
  }

  /**
   * Récupère l'historique complet d'un ticket.
   */
  async getHistory(id: string) {
    await this.findTicketById(id); // Vérifie l'existence
    return this.ticketHistory.getHistory(id);
  }

  // ─── Méthodes privées ────────────────────────────────────────────

  /**
   * Construit l'objet de mise à jour des champs SLA selon la transition de statut.
   * Gère les 4 cas : PAUSE (→PENDING), RESUME (←PENDING), START (premier démarrage), STOP (clôture).
   */
  private async buildSlaUpdateFields(
    ticket: Awaited<ReturnType<typeof this.findTicketById>>,
    oldStatus: string,
    newStatus: string,
    now: Date,
    reason?: string,
  ): Promise<Record<string, unknown>> {
    const fields: Record<string, unknown> = { status: newStatus };

    // PAUSE — passage en attente
    if (newStatus === 'PENDING_CUSTOMER' || newStatus === 'PENDING_THIRD_PARTY') {
      fields['slaPausedAt'] = now;
    }

    // RESUME — retour de PENDING vers ASSIGNED ou IN_PROGRESS
    if (
      (oldStatus === 'PENDING_CUSTOMER' || oldStatus === 'PENDING_THIRD_PARTY') &&
      (newStatus === 'ASSIGNED' || newStatus === 'IN_PROGRESS')
    ) {
      if (ticket.slaPausedAt) {
        const pauseDuration = now.getTime() - new Date(ticket.slaPausedAt).getTime();
        fields['accumulatedPauseMs'] = ticket.accumulatedPauseMs + pauseDuration;
        fields['slaPausedAt'] = null;
        if (ticket.resolutionDueAt) {
          fields['resolutionDueAt'] = new Date(new Date(ticket.resolutionDueAt).getTime() + pauseDuration);
        }
      }
    }

    // START — premier démarrage du SLA de résolution (NEW/REOPENED → ASSIGNED/IN_PROGRESS)
    if (
      (oldStatus === 'NEW' || oldStatus === 'REOPENED') &&
      (newStatus === 'ASSIGNED' || newStatus === 'IN_PROGRESS')
    ) {
      const [policy] = await this.drizzle.db
        .select()
        .from(slaPolicies)
        .where(and(eq(slaPolicies.categoryId, ticket.categoryId), eq(slaPolicies.priority, ticket.priority)))
        .limit(1);

      if (policy) {
        const calendarType = ticket.priority === 'CRITICAL' || ticket.priority === 'HIGH' ? '24_7' : 'BUSINESS_HOURS';
        const businessHours = await this.settingsService.getBusinessHours();
        const businessDays = await this.settingsService.getBusinessDays();
        fields['resolutionDueAt'] = calculateSlaDueDate(now, policy.resolutionMinutes, calendarType, businessHours, businessDays);
      }
    }

    // STOP — nettoyage de la pause sur clôture
    if (newStatus === 'RESOLVED' || newStatus === 'CLOSED' || newStatus === 'CANCELLED') {
      fields['slaPausedAt'] = null;
    }

    // Timestamps spécifiques au statut cible
    if (newStatus === 'IN_PROGRESS' && !ticket.firstResponseAt) {
      fields['firstResponseAt'] = now;
    }
    if (newStatus === 'RESOLVED') {
      fields['resolvedAt'] = now;
      if (reason) fields['resolutionSummary'] = reason;
    }
    if (newStatus === 'CLOSED') {
      fields['closedAt'] = now;
    }
    if (newStatus === 'REOPENED') {
      fields['resolvedAt'] = null;
      fields['closedAt'] = null;
      const businessHours = await this.settingsService.getBusinessHours();
      const businessDays = await this.settingsService.getBusinessDays();
      // +4h ouvrables de rallonge sur réouverture
      fields['resolutionDueAt'] = calculateSlaDueDate(now, 240, 'BUSINESS_HOURS', businessHours, businessDays);
    }

    return fields;
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
        createdAt: tickets.createdAt,
        updatedAt: tickets.updatedAt,
        creatorName: sql<string>`concat(${users.firstName}, ' ', ${users.lastName})`,
        assigneeName: sql<string>`concat(${users.firstName}, ' ', ${users.lastName})`,
        departmentName: departments.name,
      })
      .from(tickets)
      .leftJoin(users, eq(tickets.createdBy, users.id))
      .leftJoin(departments, eq(tickets.departmentId, departments.id))
      .leftJoin(categories, eq(tickets.categoryId, categories.id))
      .where(and(eq(tickets.id, id), isNull(tickets.deletedAt)))
      .limit(1);

    if (!result[0]) {
      throw new TicketNotFoundException(id);
    }

    return result[0];
  }

  private emitStatusEvent(newStatus: TicketStatus, id: string, userId: string): void {
    switch (newStatus) {
      case 'RESOLVED':
        this.eventEmitter.emit('ticket.resolved', new TicketResolvedEvent(id, userId));
        break;
      case 'CLOSED':
        this.eventEmitter.emit('ticket.closed', new TicketClosedEvent(id, userId));
        break;
      case 'REOPENED':
        this.eventEmitter.emit('ticket.reopened', new TicketReopenedEvent(id, userId));
        break;
      case 'CANCELLED':
        this.eventEmitter.emit('ticket.cancelled', new TicketCancelledEvent(id, userId));
        break;
    }
  }
}
