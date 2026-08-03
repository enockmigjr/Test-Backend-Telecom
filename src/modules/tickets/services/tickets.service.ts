/**
 * ============================================================================
 * FICHIER : src/modules/tickets/services/tickets.service.ts
 * RÔLE : Service principal de gestion du cycle de vie des tickets d'incidents télécom.
 * EXPLICATION :
 * Ce service orchestre l'ensemble des opérations métiers sur les tickets d'incidents :
 * 1. Création de tickets avec calcul dynamique des échéances SLA (heures ouvrables / 24h/24 7j/7).
 * 2. Moteur de transition de statut (NEW -> ASSIGNED -> IN_PROGRESS -> PENDING -> RESOLVED -> CLOSED).
 * 3. Gestion fine des autorisations basées sur la propriété et les rôles (ABAC/RBAC).
 * 4. Assignation, auto-assignation et escalade hiérarchique ou fonctionnelle.
 * 5. Émission d'événements de domaine (Domain Events) post-transaction PostgreSQL.
 * ============================================================================
 */

import { Injectable, Logger, BadRequestException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { generateUuid } from '../../../common/helpers/uuidv7.helper';
import { CreateTicketInput, UpdateTicketInput } from '../dto/ticket-service.interfaces';

import { DrizzleProvider } from '../../../database/drizzle.provider';
import {
  categories,
  departments,
  externalRequesters,
  outboxEvents,
  slaPolicies,
  ticketAssignments,
  tickets,
  supportIntegrations,
  users,
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
import { TicketAssignmentTargetService } from './ticket-assignment-target.service';
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
import { internalActor, toTicketActorColumns } from '../domain/ticket-actor';
import { TicketCreationCommand, TicketRequesterContext } from '../domain/ticket-creation-command';
import { toPublicTicketStatus } from '../domain/public-ticket-status';

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

/**
 * Service orchestrateur du domaine des tickets d'incidents.
 */
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
    private readonly assignmentTarget: TicketAssignmentTargetService,
  ) {}

  /**
   * Crée un nouveau ticket d'incident télécom avec calcul des dates limites SLA.
   *
   * @param dto Données du ticket (titre, description, priorité, sévérité, catégorie, client).
   * @param createdBy Identifiant de l'utilisateur créateur.
   * @returns Le ticket créé et un message de confirmation.
   * @throws BadRequestException Si aucune politique SLA ne correspond au couple (catégorie, priorité).
   */
  async create(dto: CreateTicketInput, createdBy: string) {
    return this.createFromCommand({ input: dto, actor: internalActor(createdBy), outboxEvents: [] });
  }

  /** Exécute la création commune interne/publique dans une transaction métier atomique. */
  async createFromCommand(command: TicketCreationCommand) {
    const dto = command.input;
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
        `Aucune politique SLA trouvée pour cette catégorie et cette priorité. Vérifiez les politiques SLA disponibles.`,
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

    const resolutionDueAt = calculateSlaDueDate(
      now,
      policy.resolutionMinutes,
      calendarType,
      businessHours,
      businessDays,
    );

    const requester = this.resolveRequesterContext(command);
    const actorColumns = toTicketActorColumns(command.actor, requester?.supportIntegrationId);
    const created = await this.drizzle.runInTransaction(async () => {
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
        createdBy: actorColumns.userId,
        openedByUserId: actorColumns.userId,
        requesterId: requester?.requesterId ?? null,
        supportIntegrationId: requester?.supportIntegrationId ?? null,
        sourceChannel: command.sourceChannel ?? 'INTERNAL',
        tags: dto.tags || null,
        firstResponseDueAt,
        resolutionDueAt,
      });

      const persisted = await this.findTicketById(id);

      // Enregistrer dans l'historique
      await this.ticketHistory.recordByActor(
        id,
        command.actor,
        'TICKET_CREATED',
        null,
        { ticketNumber, title: dto.title },
        undefined,
        requester?.supportIntegrationId,
      );

      // Émettre l'événement de domaine
      for (const event of command.outboxEvents ?? []) {
        await this.drizzle.db.insert(outboxEvents).values({
          id: generateUuid(),
          mutationId: event.mutationId,
          schemaVersion: event.schemaVersion,
          supportIntegrationId: requester?.supportIntegrationId ?? null,
          actorType: actorColumns.actorType,
          userId: actorColumns.userId,
          externalRequesterId: actorColumns.externalRequesterId,
          aggregateType: 'TICKET',
          aggregateId: id,
          eventType: event.eventType,
          deduplicationKey: event.deduplicationKey,
          payload: { ...event.payload },
        });
      }
      this.emitAfterCommit('ticket.created', new TicketCreatedEvent(persisted, command.actor));

      // Métriques Prometheus
      this.drizzle.afterCommit(() => {
        this.metricsService.ticketsCreatedTotal.inc({ priority: dto.priority, category: categoryName });
        this.metricsService.ticketsActive.inc();

        this.logger.log(`Ticket créé: ${ticketNumber} (${id}) par ${command.actor.type}`);
      });
      return persisted;
    });

    return { message: 'Ticket créé avec succès.', data: created };
  }

  /**
   * Récupère les détails d'un ticket par son identifiant unique UUIDv7.
   *
   * @param id Identifiant du ticket.
   * @returns Un objet enveloppant les détails du ticket.
   * @throws TicketNotFoundException Si le ticket n'existe pas ou est supprimé.
   */
  async findById(id: string) {
    const ticket = await this.findTicketById(id);
    return { data: ticket };
  }

  /**
   * Met à jour les informations d'un ticket après validation des permissions de l'utilisateur.
   *
   * @param id Identifiant du ticket.
   * @param dto Données à modifier.
   * @param user Utilisateur effectuant la requête.
   * @returns Le ticket mis à jour.
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

    await this.ticketHistory.recordByActor(
      id,
      internalActor(user.sub),
      'UPDATED',
      ticket,
      updateData,
      undefined,
      ticket.supportIntegrationId ?? undefined,
    );

    const updated = await this.findTicketById(id);
    return { message: 'Ticket mis à jour avec succès.', data: updated };
  }

  /**
   * Effectue un changement de statut sur un ticket en appliquant les règles de transition et de calcul SLA.
   *
   * @param id Identifiant du ticket.
   * @param newStatus Nouveau statut visé (ex: IN_PROGRESS, RESOLVED, PENDING_CUSTOMER).
   * @param user Utilisateur effectuant la transition.
   * @param reason Motif du changement de statut (obligatoire pour réouverture ou résolution).
   * @returns Le ticket avec son statut mis à jour.
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

    // Émettre l'événement de changement de statut
    this.emitAfterCommit(
      'ticket.status_changed',
      new TicketStatusChangedEvent(id, oldStatus, newStatus, user.sub, ticket.supportIntegrationId),
    );

    // Émettre des événements spécifiques
    this.emitStatusEvent(newStatus, id, user.sub, ticket.supportIntegrationId);

    // Métriques Prometheus — décrémenter les tickets actifs si terminé
    if (['RESOLVED', 'CLOSED', 'CANCELLED'].includes(newStatus)) {
      this.metricsService.ticketsActive.dec();
    }
    // Incrémenter si réouvert
    if (newStatus === 'REOPENED') {
      this.metricsService.ticketsActive.inc();
    }

    const updated = await this.findTicketById(id);
    return { message: `Statut changé : ${oldStatus} -> ${newStatus}`, data: updated };
  }

  /**
   * Assigne un ticket à un agent ou permet à un agent de s'auto-assigner un ticket.
   *
   * @param id Identifiant du ticket.
   * @param toUserId Identifiant de l'agent destinataire.
   * @param user Utilisateur effectuant l'attribution.
   * @param reason Motif d'assignation facultatif.
   */
  async assign(id: string, toUserId: string, user: JwtPayload, reason?: string) {
    const ticket = await this.findTicketById(id);

    // 1. Valider la permission d'assignation
    const { isAutoAssign } = this.ticketPermissions.checkCanAssign(ticket, toUserId, user);
    await this.assignmentTarget.assertEligible(toUserId, ticket.assignedTeamId);

    // 2. Créer l'entrée d'assignation
    await this.drizzle.db.insert(ticketAssignments).values({
      id: generateUuid(),
      ticketId: id,
      fromUserId: ticket.assignedTo || null,
      toUserId,
      fromDepartmentId: ticket.assignedTeamId || null,
      toDepartmentId: ticket.assignedTeamId,
      assignedBy: user.sub,
      actorType: 'INTERNAL',
      reason: reason || null,
    });

    // 3. Mettre à jour le ticket
    // Si c'est un s'auto-assigner de ticket NEW, on fait automatiquement la transition vers ASSIGNED
    const newStatus = isAutoAssign ? 'ASSIGNED' : ticket.status === 'NEW' ? 'ASSIGNED' : ticket.status;
    await this.drizzle.db
      .update(tickets)
      .set({ assignedTo: toUserId, status: newStatus as typeof tickets.$inferSelect.status })
      .where(eq(tickets.id, id));

    await this.ticketHistory.recordByActor(
      id,
      internalActor(user.sub),
      'ASSIGNED',
      { assignedTo: ticket.assignedTo, status: ticket.status },
      { assignedTo: toUserId, status: newStatus },
      { reason },
      ticket.supportIntegrationId ?? undefined,
    );

    this.emitAfterCommit(
      'ticket.assigned',
      new TicketAssignedEvent(id, toUserId, user.sub, ticket.supportIntegrationId),
    );
    this.logger.log(`Ticket ${ticket.ticketNumber} assigné à ${toUserId} par ${user.sub} (auto: ${isAutoAssign})`);

    const updated = await this.findTicketById(id);
    return {
      message: isAutoAssign ? 'Ticket auto-assigné avec succès.' : 'Ticket assigné avec succès.',
      data: updated,
    };
  }

  /**
   * Escalade un ticket d'incident vers un autre agent ou un autre département.
   *
   * @param id Identifiant du ticket.
   * @param toUserId Nouvel agent cible.
   * @param toDepartmentId Nouveau département ou équipe réseau cible.
   * @param user Utilisateur à l'origine de l'escalade.
   * @param reason Raison de l'escalade.
   */
  async escalate(id: string, toUserId: string, toDepartmentId: string, user: JwtPayload, reason?: string) {
    const ticket = await this.findTicketById(id);

    // 1. Valider la permission d'escalade
    const { isHierarchical } = this.ticketPermissions.checkCanEscalate(ticket, toDepartmentId, user);
    await this.assignmentTarget.assertEligible(toUserId, toDepartmentId);

    await this.drizzle.db.insert(ticketAssignments).values({
      id: generateUuid(),
      ticketId: id,
      fromUserId: ticket.assignedTo || null,
      toUserId,
      fromDepartmentId: ticket.assignedTeamId || null,
      toDepartmentId,
      assignedBy: user.sub,
      actorType: 'INTERNAL',
      reason: reason || null,
    });

    await this.drizzle.db
      .update(tickets)
      .set({ assignedTo: toUserId, assignedTeamId: toDepartmentId })
      .where(eq(tickets.id, id));

    await this.ticketHistory.recordByActor(
      id,
      internalActor(user.sub),
      'ESCALATED',
      { assignedTo: ticket.assignedTo, assignedTeamId: ticket.assignedTeamId },
      { assignedTo: toUserId, assignedTeamId: toDepartmentId },
      { reason, type: isHierarchical ? 'hierarchical' : 'functional' },
      ticket.supportIntegrationId ?? undefined,
    );

    this.emitAfterCommit(
      'ticket.escalated',
      new TicketEscalatedEvent(id, toUserId, user.sub, ticket.supportIntegrationId),
    );
    this.logger.log(
      `Ticket ${ticket.ticketNumber} escaladé par ${user.sub} (type: ${isHierarchical ? 'hierarchical' : 'functional'})`,
    );

    const updated = await this.findTicketById(id);
    return {
      message: `Ticket escaladé avec succès (${isHierarchical ? 'hiérarchique' : 'fonctionnelle'}).`,
      data: updated,
    };
  }

  /**
   * Effectue la suppression logique (soft delete) d'un ticket.
   *
   * @param id Identifiant du ticket à archiver.
   */
  async softDelete(id: string) {
    const ticket = await this.findTicketById(id);
    await this.drizzle.db.update(tickets).set({ deletedAt: new Date() }).where(eq(tickets.id, id));

    this.logger.log(`Ticket ${ticket.ticketNumber} supprimé (soft delete)`);
  }

  /**
   * Récupère l'historique complet des événements et modifications subis par le ticket.
   *
   * @param id Identifiant du ticket.
   * @returns Liste chronologique des actions enregistrées sur le ticket.
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
  private resolveRequesterContext(command: TicketCreationCommand): TicketRequesterContext | undefined {
    if (command.actor.type === 'EXTERNAL_REQUESTER') {
      const actorContext = {
        requesterId: command.actor.externalRequesterId,
        supportIntegrationId: command.actor.supportIntegrationId,
      };
      if (
        command.requester &&
        (command.requester.requesterId !== actorContext.requesterId ||
          command.requester.supportIntegrationId !== actorContext.supportIntegrationId)
      ) {
        throw new BadRequestException("Le demandeur ne correspond pas à l'acteur externe.");
      }
      if (!command.sourceChannel || command.sourceChannel === 'INTERNAL') {
        throw new BadRequestException('Un canal public explicite est requis pour un demandeur externe.');
      }
      return actorContext;
    }
    if (command.actor.type === 'SYSTEM' && !command.requester) {
      throw new BadRequestException('Une création système doit cibler un demandeur externe.');
    }
    return command.requester;
  }

  private async buildSlaUpdateFields(
    ticket: Awaited<ReturnType<typeof this.findTicketById>>,
    oldStatus: string,
    newStatus: string,
    now: Date,
    reason?: string,
  ): Promise<Record<string, unknown>> {
    const fields: Record<string, unknown> = { status: newStatus };

    // PAUSE — passage en attente client ou tiers
    if (newStatus === 'PENDING_CUSTOMER' || newStatus === 'PENDING_THIRD_PARTY') {
      fields['slaPausedAt'] = now;
    }

    // RESUME — retour de PENDING vers ASSIGNED ou IN_PROGRESS (recalcul dynamique de resolutionDueAt)
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

    // STOP — nettoyage de la pause sur clôture/résolution
    if (newStatus === 'RESOLVED' || newStatus === 'CLOSED' || newStatus === 'CANCELLED') {
      fields['slaPausedAt'] = null;
    }

    // Horodatages spécifiques au statut cible
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
      // +4h ouvrables de rallonge sur réouverture d'incident
      fields['resolutionDueAt'] = calculateSlaDueDate(now, 240, 'BUSINESS_HOURS', businessHours, businessDays);
    }

    return fields;
  }

  /**
   * Effectue la requête SQL avec jointures (créateur, assigné, département, équipe, catégorie) pour rapatrier un ticket.
   */
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

    if (!result[0]) {
      throw new TicketNotFoundException(id);
    }

    if (result[0].createdBy && !result[0].openedByUserId) {
      this.metricsService.legacyTicketActorFallbackTotal.inc({ surface: 'ticket_detail' });
    }

    return result[0];
  }

  /**
   * Émet l'événement de domaine approprié selon le statut vers lequel le ticket a basculé.
   */
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

  /**
   * Émet un événement de domaine de façon sécurisée après la validation définitive (commit) de la transaction PostgreSQL.
   */
  private emitAfterCommit(event: string, payload: object): void {
    const effect = () => {
      this.eventEmitter.emit(event, payload);
    };
    if (typeof this.drizzle.afterCommit === 'function') this.drizzle.afterCommit(effect);
    else effect();
  }
}
