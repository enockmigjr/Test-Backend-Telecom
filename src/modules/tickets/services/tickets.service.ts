import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq, and, isNull, sql, count } from 'drizzle-orm';
import { generateUuid } from '../../../common/helpers/uuidv7.helper';

import { DrizzleProvider } from '../../../database/drizzle.provider';
import { tickets, ticketAssignments, slaPolicies, users, departments, ticketComments } from '../../../database/schemas';
import { TicketStateMachine, TicketStatus } from '../domain/ticket-status-transitions';
import { TicketPermissions } from '../domain/ticket-permissions';
import { TicketNumberService } from './ticket-number.service';
import { TicketHistoryService } from './ticket-history.service';
import { TicketNotFoundException } from '../domain/exceptions/ticket-not-found.exception';
import { MetricsService } from '../../../common/metrics/metrics.service';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
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
      throw new BadRequestException(
        `Aucune politique SLA trouvee pour la combinaison category='${dto.category}' / priority='${dto.priority}'. Verifiez les politiques SLA disponibles.`,
      );
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

    // Métriques Prometheus
    this.metricsService.ticketsCreatedTotal.inc({ priority: dto.priority, category: dto.category });
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
    user: JwtPayload,
  ) {
    const ticket = await this.findTicketById(id);

    // Déterminer quels champs sont modifiés pour valider les permissions correspondantes
    const updatedFields = Object.keys(dto).filter((key) => dto[key as keyof typeof dto] !== undefined);
    this.ticketPermissions.checkCanUpdateFields(ticket, user, updatedFields);

    const updateData: Record<string, unknown> = {};
    if (dto.title !== undefined) updateData['title'] = dto.title;
    if (dto.description !== undefined) updateData['description'] = dto.description;
    if (dto.priority !== undefined) updateData['priority'] = dto.priority;
    if (dto.severity !== undefined) updateData['severity'] = dto.severity;
    if (dto.category !== undefined) updateData['category'] = dto.category;
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

    // 2. Valider les permissions d'ownership-based d'accès à la transition
    if (newStatus === 'IN_PROGRESS') {
      const isAssignee = ticket.assignedTo === user.sub;
      const isSupervisor = user.role === 'SUPERVISOR';
      const isAdmin = user.role === 'ADMINISTRATOR';
      if (!isAssignee && !isSupervisor && !isAdmin) {
        throw new BadRequestException(
          "Seul l'agent assigne, un superviseur ou un administrateur peut demarrer le traitement de ce ticket.",
        );
      }
    } else if (newStatus === 'RESOLVED') {
      const isAssignee = ticket.assignedTo === user.sub;
      const isSupervisor = user.role === 'SUPERVISOR';
      const isAdmin = user.role === 'ADMINISTRATOR';
      if (!isAssignee && !isSupervisor && !isAdmin) {
        throw new BadRequestException(
          "Seul l'agent assigne, un superviseur ou un administrateur peut resoudre ce ticket.",
        );
      }
    } else if (newStatus === 'CLOSED') {
      this.ticketPermissions.checkCanClose(ticket, user);
    } else if (newStatus === 'REOPENED') {
      this.ticketPermissions.checkCanReopen(ticket, user);
    } else if (newStatus === 'PENDING_CUSTOMER' || newStatus === 'PENDING_THIRD_PARTY') {
      const isAssignee = ticket.assignedTo === user.sub;
      const isSupervisor = user.role === 'SUPERVISOR';
      const isAdmin = user.role === 'ADMINISTRATOR';
      if (!isAssignee && !isSupervisor && !isAdmin) {
        throw new BadRequestException(
          "Seul l'agent assigne, un superviseur ou un administrateur peut mettre ce ticket en attente.",
        );
      }
    } else if (newStatus === 'CANCELLED') {
      const isSupervisor = user.role === 'SUPERVISOR';
      const isAdmin = user.role === 'ADMINISTRATOR';
      if (!isSupervisor && !isAdmin) {
        throw new BadRequestException('Seul un superviseur ou un administrateur peut annuler ce ticket.');
      }
    }

    const updateFields: Record<string, unknown> = { status: newStatus };

    // Actions spécifiques selon le statut cible
    if (newStatus === 'IN_PROGRESS' && !ticket.firstResponseAt) {
      updateFields['firstResponseAt'] = new Date();
    }
    if (newStatus === 'RESOLVED') {
      updateFields['resolvedAt'] = new Date();
      if (reason) {
        updateFields['resolutionSummary'] = reason;
      }
    }
    if (newStatus === 'CLOSED') {
      updateFields['closedAt'] = new Date();
    }
    if (newStatus === 'REOPENED') {
      // Re-ouvrir le ticket remet son resolvedAt et closedAt à null
      updateFields['resolvedAt'] = null;
      updateFields['closedAt'] = null;
      // Recalculer le SLA à la réouverture (optionnel : ici on peut repousser de la durée restante ou recréer une échéance)
      const now = new Date();
      updateFields['resolutionDueAt'] = new Date(now.getTime() + 4 * 60 * 60 * 1000); // Ex: Rallonge de 4h
    }

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
