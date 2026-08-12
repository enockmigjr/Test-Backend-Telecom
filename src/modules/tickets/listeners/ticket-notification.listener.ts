/**
 * ============================================================================
 * FICHIER : src/modules/tickets/listeners/ticket-notification.listener.ts
 * RÔLE : Écouteur d'événements pour la diffusion multi-canal des notifications de tickets.
 * EXPLICATION :
 * Ce composant réagit à l'ensemble du cycle de vie des tickets et applique une stratégie de notification à 3 niveaux :
 * 1. WebSockets temps réel (`wsGateway.emitToDepartment` / `emitToUser`) : Informe instantanément les utilisateurs connectés.
 * 2. File `NOTIFICATION_QUEUE` (BullMQ) : Persiste la notification en base de données (consultable même en cas de connexion ultérieure).
 * 3. File `EMAIL_QUEUE` (BullMQ) : Déclenche l'envoi d'emails stylisés Handlebars pour les événements critiques (`ticketCreated`, `ticketAssigned`, `ticketDeassigned`).
 * ============================================================================
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { eq, and, isNull } from 'drizzle-orm';
import { BullMqQueues } from '../../../queues/queues.types';
import {
  TicketCreatedEvent,
  TicketAssignedEvent,
  TicketEscalatedEvent,
  TicketResolvedEvent,
  TicketClosedEvent,
  TicketStatusChangedEvent,
  TicketReopenedEvent,
  TicketDeassignedEvent,
} from '../domain/ticket.events';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { departments, users, tickets, categories } from '../../../database/schemas';
import { TelecomWebSocketGateway } from '../../../websocket/websocket.gateway';

interface TicketEmailContext {
  ticketNumber: string;
  title: string;
  description: string | null;
  priority: string;
  severity: string;
  category: string;
  department: string;
  slaDueAt: string;
}

/**
 * Listener de notifications multi-canal pour les événements de domaine Ticket.
 */
@Injectable()
export class TicketNotificationListener {
  private readonly logger = new Logger(TicketNotificationListener.name);

  constructor(
    @Inject('BullMQ_Queues') private readonly queues: BullMqQueues,
    private readonly drizzle: DrizzleProvider,
    private readonly wsGateway: TelecomWebSocketGateway,
  ) {}

  private get emailQueue(): Queue {
    return this.queues.email;
  }

  private get notificationQueue(): Queue {
    return this.queues.notification;
  }

  /** Récupère l'email ET le nom complet d'un utilisateur */
  private async getUserInfo(userId: string): Promise<{ email: string; fullName: string } | null> {
    try {
      const [user] = await this.drizzle.db
        .select({ email: users.email, firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(and(eq(users.id, userId), isNull(users.deletedAt)))
        .limit(1);
      if (!user) return null;
      return {
        email: user.email as string,
        fullName: `${user.firstName as string} ${user.lastName as string}`.trim(),
      };
    } catch {
      return null;
    }
  }

  /** Récupère uniquement l'email d'un utilisateur */
  private async getUserEmail(userId: string): Promise<string | null> {
    const info = await this.getUserInfo(userId);
    return info?.email ?? null;
  }

  private formatDateTime(value: Date | null): string {
    return (
      value?.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }) ?? 'Non renseigné'
    );
  }

  /** Récupère les champs utilisés par les templates email de ticket */
  private async getTicketEmailContext(ticketId: string): Promise<TicketEmailContext | null> {
    try {
      const [ticket] = await this.drizzle.db
        .select({
          ticketNumber: tickets.ticketNumber,
          title: tickets.title,
          description: tickets.description,
          priority: tickets.priority,
          severity: tickets.severity,
          category: categories.name,
          department: departments.name,
          resolutionDueAt: tickets.resolutionDueAt,
        })
        .from(tickets)
        .leftJoin(departments, eq(tickets.departmentId, departments.id))
        .leftJoin(categories, eq(tickets.categoryId, categories.id))
        .where(and(eq(tickets.id, ticketId), isNull(tickets.deletedAt)))
        .limit(1);
      if (!ticket) return null;
      return {
        ticketNumber: ticket.ticketNumber as string,
        title: ticket.title as string,
        description: ticket.description as string | null,
        priority: ticket.priority as string,
        severity: ticket.severity as string,
        category: ticket.category as string,
        department: (ticket.department as string | null) ?? 'Non renseigné',
        slaDueAt: this.formatDateTime(ticket.resolutionDueAt as Date | null),
      };
    } catch {
      return null;
    }
  }

  private async emitToTicketDepartment(ticketId: string, event: string, payload: unknown): Promise<void> {
    const [ticket] = await this.drizzle.db
      .select({ assignedTeamId: tickets.assignedTeamId })
      .from(tickets)
      .where(and(eq(tickets.id, ticketId), isNull(tickets.deletedAt)))
      .limit(1);

    if (ticket) this.wsGateway.emitToDepartment(ticket.assignedTeamId, event, payload);
  }

  /** Enfile un job email de façon résiliente */
  private async sendEmail(data: Record<string, unknown>): Promise<void> {
    try {
      await this.emailQueue.add('send-email', data);
    } catch (err) {
      this.logger.warn(`Email queue unavailable. Job dropped: ${String(err)}`);
    }
  }

  /** Enfile une notification de façon résiliente */
  private async createNotification(data: Record<string, unknown>): Promise<void> {
    try {
      // Le listener émet déjà l'événement de domaine en WebSocket direct :
      // on demande au worker de ne pas re-émettre notification.created (déduplication).
      await this.notificationQueue.add('create-notification', { ...data, emitWs: false });
    } catch (err) {
      this.logger.warn(`Notification queue unavailable. Job dropped: ${String(err)}`);
    }
  }

  /**
   * Notifie la création d'un ticket au département et envoie un email de confirmation au créateur.
   */
  @OnEvent('ticket.created')
  async handleTicketCreated(event: TicketCreatedEvent): Promise<void> {
    const ticketNumber = event.ticket['ticketNumber'] as string;
    const title = event.ticket['title'] as string;
    const priority = event.ticket['priority'] as string;
    const category = event.ticket['category'] as string;
    const departmentId = event.ticket['departmentId'] as string;
    const assignedTeamId = event.ticket['assignedTeamId'] as string;
    const creatorId = event.userId;

    this.logger.log(`Notification: ticket créé ${ticketNumber}`);

    // Émettre en temps réel au département propriétaire
    const payload = { ticketId: event.ticket['id'], ticketNumber, title, priority, createdBy: creatorId };
    for (const authorizedDepartmentId of new Set([departmentId, assignedTeamId])) {
      this.wsGateway.emitToDepartment(authorizedDepartmentId, 'ticket.created', payload);
    }

    // Email de confirmation au créateur
    const appUrl = process.env['APP_URL'] || 'http://localhost:3000';
    const ticketId = event.ticket['id'] as string;
    const creatorInfo = creatorId ? await this.getUserInfo(creatorId) : null;
    if (creatorInfo) {
      await this.sendEmail({
        to: creatorInfo.email,
        subject: `✅ Ticket créé — ${ticketNumber}`,
        template: 'ticketCreated',
        data: {
          ticketNumber,
          title,
          priority,
          category,
          creatorName: creatorInfo.fullName,
          ticketUrl: `${appUrl}/tickets/${ticketId}`,
        },
      });
    }
  }

  /**
   * Notifie l'assignation d'un ticket à l'agent destinataire (WebSocket + In-App DB + Email).
   */
  @OnEvent('ticket.assigned')
  async handleTicketAssigned(event: TicketAssignedEvent): Promise<void> {
    this.logger.log(`Notification: ticket ${event.ticketId} assigné à ${event.assignedTo}`);

    // WebSocket → utilisateur assigné
    this.wsGateway.emitToUser(event.assignedTo, 'ticket.assigned', {
      ticketId: event.ticketId,
      assignedBy: event.assignedBy,
    });

    // Persistance en DB via notification-queue (visible même si offline)
    await this.createNotification({
      userId: event.assignedTo,
      type: 'TICKET_ASSIGNED',
      title: 'Nouveau ticket assigné',
      message: `Le ticket a été assigné vers vous.`,
      referenceType: 'ticket',
      referenceId: event.ticketId,
    });

    // Email à l'assigné
    const assigneeInfo = await this.getUserInfo(event.assignedTo);
    if (assigneeInfo) {
      const ticket = await this.getTicketEmailContext(event.ticketId);
      const supervisorInfo = event.assignedBy ? await this.getUserInfo(event.assignedBy) : null;
      const appUrl = process.env['APP_URL'] || 'http://localhost:3000';
      await this.sendEmail({
        to: assigneeInfo.email,
        subject: `📋 Ticket assigné — ${ticket?.ticketNumber ?? event.ticketId}`,
        template: 'ticketAssigned',
        data: {
          assigneeName: assigneeInfo.fullName,
          supervisorName: supervisorInfo?.fullName ?? 'Un superviseur',
          ticketNumber: ticket?.ticketNumber ?? event.ticketId,
          ticketTitle: ticket?.title ?? 'Sans titre',
          category: ticket?.category ?? 'Non renseigné',
          severity: ticket?.severity ?? 'Non renseigné',
          priority: ticket?.priority ?? 'Non renseigné',
          department: ticket?.department ?? 'Non renseigné',
          slaDueAt: ticket?.slaDueAt ?? 'Non renseigné',
          description: ticket?.description ?? null,
          ticketUrl: `${appUrl}/tickets/${event.ticketId}`,
        },
      });
    }
  }

  /**
   * Notifie l'escalade d'un ticket vers un nouvel agent ou une nouvelle équipe.
   */
  @OnEvent('ticket.escalated')
  async handleTicketEscalated(event: TicketEscalatedEvent): Promise<void> {
    this.logger.log(`Notification: ticket ${event.ticketId} escaladé à ${event.escalatedTo}`);

    // WebSocket → utilisateur cible
    this.wsGateway.emitToUser(event.escalatedTo, 'ticket.escalated', {
      ticketId: event.ticketId,
      escalatedBy: event.escalatedBy,
    });

    await this.emitToTicketDepartment(event.ticketId, 'ticket.escalated', {
      ticketId: event.ticketId,
      escalatedTo: event.escalatedTo,
      escalatedBy: event.escalatedBy,
    });

    // Persistance notification
    await this.createNotification({
      userId: event.escalatedTo,
      type: 'TICKET_ESCALATED',
      title: 'Ticket escaladé',
      message: `Le ticket a été escaladé vers vous.`,
      referenceType: 'ticket',
      referenceId: event.ticketId,
    });

    // Email
    const escalatedToInfo = await this.getUserInfo(event.escalatedTo);
    if (escalatedToInfo) {
      const ticket = await this.getTicketEmailContext(event.ticketId);
      const escalatedByInfo = event.escalatedBy ? await this.getUserInfo(event.escalatedBy) : null;
      const appUrl = process.env['APP_URL'] || 'http://localhost:3000';
      await this.sendEmail({
        to: escalatedToInfo.email,
        subject: `⚠️ Ticket escaladé — ${ticket?.ticketNumber ?? event.ticketId}`,
        template: 'ticketAssigned',
        data: {
          assigneeName: escalatedToInfo.fullName,
          supervisorName: escalatedByInfo?.fullName ?? 'Un superviseur',
          ticketNumber: ticket?.ticketNumber ?? event.ticketId,
          ticketTitle: ticket?.title ?? 'Sans titre',
          category: ticket?.category ?? 'Non renseigné',
          severity: ticket?.severity ?? 'Non renseigné',
          priority: ticket?.priority ?? 'Non renseigné',
          department: ticket?.department ?? 'Non renseigné',
          slaDueAt: ticket?.slaDueAt ?? 'Non renseigné',
          description: ticket?.description ?? null,
          ticketUrl: `${appUrl}/tickets/${event.ticketId}`,
        },
      });
    }
  }

  /**
   * Notifie la résolution d'un ticket.
   */
  @OnEvent('ticket.resolved')
  async handleTicketResolved(event: TicketResolvedEvent): Promise<void> {
    this.logger.log(`Notification: ticket ${event.ticketId} résolu`);

    // Notification WebSocket
    if (event.resolvedBy) {
      this.wsGateway.emitToUser(event.resolvedBy, 'ticket.resolved', { ticketId: event.ticketId });
    }

    await this.emitToTicketDepartment(event.ticketId, 'ticket.resolved', {
      ticketId: event.ticketId,
      resolvedBy: event.resolvedBy,
    });

    // Persistance
    if (event.resolvedBy)
      await this.createNotification({
        userId: event.resolvedBy,
        type: 'TICKET_RESOLVED',
        title: 'Ticket résolu',
        message: `Le ticket a été résolu avec succès.`,
        referenceType: 'ticket',
        referenceId: event.ticketId,
      });
  }

  /**
   * Notifie la clôture définitive d'un ticket aux parties prenantes.
   */
  @OnEvent('ticket.closed')
  async handleTicketClosed(event: TicketClosedEvent): Promise<void> {
    const [ticket] = await this.drizzle.db
      .select({
        ticketNumber: tickets.ticketNumber,
        assignedTo: tickets.assignedTo,
        createdBy: tickets.createdBy,
      })
      .from(tickets)
      .where(and(eq(tickets.id, event.ticketId), isNull(tickets.deletedAt)))
      .limit(1);
    const payload = {
      ticketId: event.ticketId,
      ticketNumber: ticket?.ticketNumber ?? event.ticketId,
      closedBy: event.closedBy,
    };

    if (event.closedBy) this.wsGateway.emitToUser(event.closedBy, 'ticket.closed', payload);
    await this.emitToTicketDepartment(event.ticketId, 'ticket.closed', payload);
    const recipients = new Set(
      [event.closedBy, ticket?.assignedTo, ticket?.createdBy].filter((id): id is string => Boolean(id)),
    );
    for (const userId of recipients) {
      await this.createNotification({
        userId,
        type: 'TICKET_RESOLVED',
        title: `Ticket clôturé — ${payload.ticketNumber}`,
        message: 'Le ticket a été clôturé avec succès.',
        referenceType: 'ticket',
        referenceId: event.ticketId,
      });
    }
  }

  /**
   * Notifie la réouverture d'un ticket à l'agent assigné.
   */
  @OnEvent('ticket.reopened')
  async handleTicketReopened(event: TicketReopenedEvent): Promise<void> {
    this.logger.log(`Notification: ticket ${event.ticketId} réouvert par ${event.reopenedBy}`);

    const ticket = await this.drizzle.db
      .select({
        ticketNumber: tickets.ticketNumber,
        assignedTo: tickets.assignedTo,
        assignedTeamId: tickets.assignedTeamId,
        title: tickets.title,
        description: tickets.description,
        priority: tickets.priority,
        severity: tickets.severity,
        category: categories.name,
        department: departments.name,
        resolutionDueAt: tickets.resolutionDueAt,
      })
      .from(tickets)
      .leftJoin(departments, eq(tickets.departmentId, departments.id))
      .leftJoin(categories, eq(tickets.categoryId, categories.id))
      .where(eq(tickets.id, event.ticketId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!ticket) return;

    const payload = {
      ticketId: event.ticketId,
      ticketNumber: ticket.ticketNumber,
      reopenedBy: event.reopenedBy,
    };

    this.wsGateway.emitToDepartment(ticket.assignedTeamId, 'ticket.reopened', payload);

    // WebSocket + Notification + Email → assigné
    if (ticket.assignedTo) {
      this.wsGateway.emitToUser(ticket.assignedTo, 'ticket.reopened', payload);

      await this.createNotification({
        userId: ticket.assignedTo,
        type: 'COMMENT_ADDED',
        title: `Ticket réouvert — ${ticket.ticketNumber}`,
        message: `Le ticket a été réouvert par l'agent CS.`,
        referenceType: 'ticket',
        referenceId: event.ticketId,
      });

      const assigneeInfo = await this.getUserInfo(ticket.assignedTo);
      const reopenerInfo = event.reopenedBy ? await this.getUserInfo(event.reopenedBy) : null;
      const appUrl = process.env['APP_URL'] || 'http://localhost:3000';
      if (assigneeInfo) {
        await this.sendEmail({
          to: assigneeInfo.email,
          subject: `⚠️ Ticket réouvert — ${ticket.ticketNumber}`,
          template: 'ticketAssigned',
          data: {
            assigneeName: assigneeInfo.fullName,
            supervisorName: reopenerInfo?.fullName ?? 'Un agent',
            ticketNumber: ticket.ticketNumber,
            ticketTitle: ticket.title ?? 'Sans titre',
            category: ticket.category ?? 'Non renseigné',
            severity: ticket.severity ?? 'Non renseigné',
            priority: ticket.priority ?? 'Non renseigné',
            department: ticket.department ?? 'Non renseigné',
            slaDueAt: this.formatDateTime(ticket.resolutionDueAt),
            description: ticket.description ?? null,
            ticketUrl: `${appUrl}/tickets/${event.ticketId}`,
          },
        });
      }
    }
  }

  /**
   * Notifie au département le changement de statut d'un ticket.
   */
  @OnEvent('ticket.status_changed')
  async handleStatusChanged(event: TicketStatusChangedEvent): Promise<void> {
    await this.emitToTicketDepartment(event.ticketId, 'ticket.status_changed', {
      ticketId: event.ticketId,
      oldStatus: event.oldStatus,
      newStatus: event.newStatus,
    });
  }

  /**
   * Notifie l'agent et les superviseurs de la désassignation d'urgence d'un ticket.
   */
  @OnEvent('ticket.deassigned')
  async handleTicketDeassigned(event: TicketDeassignedEvent): Promise<void> {
    const ticketCtx = await this.getTicketEmailContext(event.ticketId);
    if (!ticketCtx) return;

    const payload = {
      ticketId: event.ticketId,
      ticketNumber: ticketCtx.ticketNumber,
      title: ticketCtx.title,
      reason: event.reason,
    };

    this.wsGateway.emitToDepartment(event.departmentId, 'ticket.deassigned', payload);
    this.wsGateway.emitToUser(event.deassignedAgentId, 'ticket.deassigned', payload);

    await this.createNotification({
      userId: event.deassignedAgentId,
      type: 'TICKET_ASSIGNED',
      title: `Ticket désassigné d'urgence — ${ticketCtx.ticketNumber}`,
      message: `Vous avez été désassigné de ce ticket. Motif: ${event.reason}`,
      referenceType: 'ticket',
      referenceId: event.ticketId,
    });

    const agentInfo = await this.getUserInfo(event.deassignedAgentId);
    if (agentInfo) {
      await this.sendEmail({
        to: agentInfo.email,
        subject: `📋 Ticket désassigné d'urgence — ${ticketCtx.ticketNumber}`,
        template: 'ticketDeassigned',
        data: {
          ticketId: event.ticketId,
          ticketNumber: ticketCtx.ticketNumber,
          ticketTitle: ticketCtx.title,
          reason: event.reason,
        },
      });
    }

    if (event.departmentId) {
      const supervisors = await this.drizzle.db
        .select()
        .from(users)
        .where(and(eq(users.departmentId, event.departmentId), eq(users.role, 'SUPERVISOR'), eq(users.isActive, true)));

      for (const sup of supervisors) {
        await this.createNotification({
          userId: sup.id,
          type: 'TICKET_ASSIGNED',
          title: `Alerte Désassignation — ${ticketCtx.ticketNumber}`,
          message: `L'agent ${agentInfo?.fullName ?? 'indisponible'} a été désassigné du ticket. Motif: ${event.reason}`,
          referenceType: 'ticket',
          referenceId: event.ticketId,
        });

        await this.sendEmail({
          to: sup.email,
          subject: `📋 Alerte Désassignation d'urgence — ${ticketCtx.ticketNumber}`,
          template: 'ticketDeassigned',
          data: {
            ticketId: event.ticketId,
            ticketNumber: ticketCtx.ticketNumber,
            ticketTitle: ticketCtx.title,
            reason: `L'agent ${agentInfo?.fullName ?? 'indisponible'} a été désassigné. Motif: ${event.reason}`,
          },
        });
      }
    }
  }
}
