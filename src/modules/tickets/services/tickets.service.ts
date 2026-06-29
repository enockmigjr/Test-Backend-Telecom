import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { generateUuid } from '../../../common/helpers/uuidv7.helper';

import { DrizzleProvider } from '../../../database/drizzle.provider';
import { tickets, ticketAssignments, slaPolicies, users, departments } from '../../../database/schemas';
import { TicketStateMachine, TicketStatus } from '../domain/ticket-status-transitions';
import { TicketNumberService } from './ticket-number.service';
import { TicketHistoryService } from './ticket-history.service';
import { TicketNotFoundException } from '../domain/exceptions/ticket-not-found.exception';
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
    private readonly ticketNumber: TicketNumberService,
    private readonly ticketHistory: TicketHistoryService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Crée un nouveau ticket d'incident.
   */
  async create(
    dto: {
      title: string;
      description: string;
      priority: string;
      severity: string;
      category: string;
      departmentId: string;
      assignedTeamId: string;
      customerAccountNumber?: string;
      customerName?: string;
      customerContact?: string;
      tags?: string;
    },
    createdBy: string,
  ) {
    // Trouver la politique SLA correspondante
    const [policy] = await this.drizzle.db
      .select()
      .from(slaPolicies)
      .where(
        and(
          eq(slaPolicies.category, dto.category as typeof slaPolicies.$inferSelect.category),
          eq(slaPolicies.priority, dto.priority as typeof slaPolicies.$inferSelect.priority),
        ),
      )
      .limit(1);

    if (!policy) {
      throw new Error(`Aucune politique SLA trouvée pour ${dto.category}/${dto.priority}`);
    }

    const ticketNumber = await this.ticketNumber.generate();
    const id = generateUuid();
    const now = new Date();
    const firstResponseDueAt = new Date(now.getTime() + policy.firstResponseMinutes * 60 * 1000);
    const resolutionDueAt = new Date(now.getTime() + policy.resolutionMinutes * 60 * 1000);

    await this.drizzle.db.insert(tickets).values({
      id,
      ticketNumber,
      title: dto.title,
      description: dto.description,
      status: 'NEW' as const,
      priority: dto.priority as typeof tickets.$inferSelect.priority,
      severity: dto.severity as typeof tickets.$inferSelect.severity,
      category: dto.category as typeof tickets.$inferSelect.category,
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

    this.logger.log(`Ticket créé: ${ticketNumber} (${id}) par ${createdBy}`);

    return { message: 'Ticket créé avec succès.', data: created };
  }

  /**
   * Récupère un ticket par son ID avec toutes les relations.
   */
  async findById(id: string) {
    const ticket = await this.findTicketById(id);
    return { data: ticket };
  }

  /**
   * Met à jour les informations d'un ticket.
   */
  async update(
    id: string,
    dto: {
      title?: string;
      description?: string;
      priority?: string;
      severity?: string;
      category?: string;
      tags?: string;
    },
    userId: string,
  ) {
    const ticket = await this.findTicketById(id);

    const updateData: Record<string, unknown> = {};
    if (dto.title) updateData['title'] = dto.title;
    if (dto.description) updateData['description'] = dto.description;
    if (dto.priority) updateData['priority'] = dto.priority;
    if (dto.severity) updateData['severity'] = dto.severity;
    if (dto.category) updateData['category'] = dto.category;
    if (dto.tags) updateData['tags'] = dto.tags;

    await this.drizzle.db.update(tickets).set(updateData).where(eq(tickets.id, id));

    await this.ticketHistory.record(id, userId, 'UPDATED', ticket, updateData);

    const updated = await this.findTicketById(id);
    return { message: 'Ticket mis à jour avec succès.', data: updated };
  }

  /**
   * Change le statut d'un ticket en validant la transition.
   */
  async changeStatus(id: string, newStatus: TicketStatus, userId: string, reason?: string) {
    const ticket = await this.findTicketById(id);
    const oldStatus = ticket.status as TicketStatus;

    this.stateMachine.validateTransition(oldStatus, newStatus);

    const updateFields: Record<string, unknown> = { status: newStatus };

    // Actions spécifiques selon le statut cible
    if (newStatus === 'IN_PROGRESS' && !ticket.firstResponseAt) {
      updateFields['firstResponseAt'] = new Date();
    }
    if (newStatus === 'RESOLVED') {
      updateFields['resolvedAt'] = new Date();
    }
    if (newStatus === 'CLOSED') {
      updateFields['closedAt'] = new Date();
    }

    await this.drizzle.db.update(tickets).set(updateFields).where(eq(tickets.id, id));
    await this.ticketHistory.record(
      id,
      userId,
      'STATUS_CHANGED',
      { status: oldStatus },
      { status: newStatus },
      { reason },
    );

    // Émettre l'événement
    this.eventEmitter.emit('ticket.status_changed', new TicketStatusChangedEvent(id, oldStatus, newStatus, userId));

    // Émettre des événements spécifiques
    this.emitStatusEvent(newStatus, id, userId);

    const updated = await this.findTicketById(id);
    return { message: `Statut changé : ${oldStatus} → ${newStatus}`, data: updated };
  }

  /**
   * Assigne un ticket à un agent.
   */
  async assign(id: string, toUserId: string, assignedBy: string, reason?: string) {
    const ticket = await this.findTicketById(id);

    // Créer l'entrée d'assignation
    await this.drizzle.db.insert(ticketAssignments).values({
      id: generateUuid(),
      ticketId: id,
      fromUserId: ticket.assignedTo || null,
      toUserId,
      fromDepartmentId: ticket.assignedTeamId || null,
      toDepartmentId: ticket.assignedTeamId,
      assignedBy,
      reason: reason || null,
    });

    // Mettre à jour le ticket
    const newStatus = ticket.status === 'NEW' ? 'ASSIGNED' : ticket.status;
    await this.drizzle.db
      .update(tickets)
      .set({ assignedTo: toUserId, status: newStatus as typeof tickets.$inferSelect.status })
      .where(eq(tickets.id, id));

    await this.ticketHistory.record(
      id,
      assignedBy,
      'ASSIGNED',
      { assignedTo: ticket.assignedTo },
      { assignedTo: toUserId },
      { reason },
    );

    this.eventEmitter.emit('ticket.assigned', new TicketAssignedEvent(id, toUserId, assignedBy));
    this.logger.log(`Ticket ${ticket.ticketNumber} assigné à ${toUserId} par ${assignedBy}`);

    const updated = await this.findTicketById(id);
    return { message: 'Ticket assigné avec succès.', data: updated };
  }

  /**
   * Escalade un ticket vers un autre agent/département.
   */
  async escalate(id: string, toUserId: string, toDepartmentId: string, escalatedBy: string, reason?: string) {
    const ticket = await this.findTicketById(id);

    await this.drizzle.db.insert(ticketAssignments).values({
      id: generateUuid(),
      ticketId: id,
      fromUserId: ticket.assignedTo || null,
      toUserId,
      fromDepartmentId: ticket.assignedTeamId || null,
      toDepartmentId,
      assignedBy: escalatedBy,
      reason: reason || null,
    });

    await this.drizzle.db
      .update(tickets)
      .set({ assignedTo: toUserId, assignedTeamId: toDepartmentId })
      .where(eq(tickets.id, id));

    await this.ticketHistory.record(
      id,
      escalatedBy,
      'ESCALATED',
      { assignedTo: ticket.assignedTo, assignedTeamId: ticket.assignedTeamId },
      { assignedTo: toUserId, assignedTeamId: toDepartmentId },
      { reason },
    );

    this.eventEmitter.emit('ticket.escalated', new TicketEscalatedEvent(id, toUserId, escalatedBy));
    this.logger.log(`Ticket ${ticket.ticketNumber} escaladé par ${escalatedBy}`);

    const updated = await this.findTicketById(id);
    return { message: 'Ticket escaladé avec succès.', data: updated };
  }

  /**
   * Suppression logique (soft delete).
   */
  async softDelete(id: string) {
    const ticket = await this.findTicketById(id);
    await this.drizzle.db.update(tickets).set({ deletedAt: new Date() }).where(eq(tickets.id, id));

    this.logger.log(`Ticket ${ticket.ticketNumber} supprimé (soft delete)`);
  }

  /**
   * Récupère l'historique complet d'un ticket.
   */
  async getHistory(id: string) {
    await this.findTicketById(id); // Vérifie l'existence
    return this.ticketHistory.getHistory(id);
  }

  // ─── Méthodes privées ────────────────────────────────────────────

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
        category: tickets.category,
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
        createdAt: tickets.createdAt,
        updatedAt: tickets.updatedAt,
        creatorName: sql<string>`concat(${users.firstName}, ' ', ${users.lastName})`,
        assigneeName: sql<string>`concat(${users.firstName}, ' ', ${users.lastName})`,
        departmentName: departments.name,
      })
      .from(tickets)
      .leftJoin(users, eq(tickets.createdBy, users.id))
      .leftJoin(departments, eq(tickets.departmentId, departments.id))
      .where(and(eq(tickets.id, id), isNull(tickets.deletedAt)))
      .limit(1);

    if (!result[0]) {
      throw new TicketNotFoundException(id);
    }

    return result[0];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
