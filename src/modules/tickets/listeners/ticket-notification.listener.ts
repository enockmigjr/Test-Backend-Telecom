import { Injectable, Logger, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { eq, and, isNull } from 'drizzle-orm';
import { EMAIL_QUEUE, NOTIFICATION_QUEUE } from '../../../queues/queues.module';
import { BullMqQueues } from '../../../queues/queues.types';
import {
  TicketCreatedEvent,
  TicketAssignedEvent,
  TicketEscalatedEvent,
  TicketResolvedEvent,
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
 * Listener de notifications pour les événements de domaine Ticket.
 *
 * Stratégie de notification :
 * 1. WebSocket → temps réel si l'utilisateur est connecté
 * 2. NOTIFICATION_QUEUE → persistance en DB (lue au prochain login si offline)
 * 3. EMAIL_QUEUE → email asynchrone pour les événements critiques
 *
 * RESILIENCE : Tous les appels BullMQ sont protégés par try/catch.
 * Une indisponibilité Redis (ex: tests E2E, environnement de dev sans Redis)
 * ne doit jamais provoquer un 500 sur la requête HTTP principale.
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
    return this.queues[EMAIL_QUEUE] ?? this.queues['email'];
  }

  private get notificationQueue(): Queue {
    return this.queues[NOTIFICATION_QUEUE] ?? this.queues['notification'];
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

  /** Récupère uniquement l'email (rétrocompatibilité interne) */
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
      }) ?? 'Non renseigne'
    );
  }

  /** Récupère les champs utilises par les templates email de ticket */
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
        department: (ticket.department as string | null) ?? 'Non renseigne',
        slaDueAt: this.formatDateTime(ticket.resolutionDueAt as Date | null),
      };
    } catch {
      return null;
    }
  }

  /** Enqueue un job email de façon résiliente */
  private async sendEmail(data: Record<string, unknown>): Promise<void> {
    try {
      await this.emailQueue.add('send-email', data);
    } catch (err) {
      this.logger.warn(`Email queue unavailable. Job dropped: ${String(err)}`);
    }
  }

  /** Enqueue une notification de façon résiliente */
  private async createNotification(data: Record<string, unknown>): Promise<void> {
    try {
      await this.notificationQueue.add('create-notification', data);
    } catch (err) {
      this.logger.warn(`Notification queue unavailable. Job dropped: ${String(err)}`);
    }
  }

  @OnEvent('ticket.created')
  async handleTicketCreated(event: TicketCreatedEvent): Promise<void> {
    const ticketNumber = event.ticket['ticketNumber'] as string;
    const title = event.ticket['title'] as string;
    const priority = event.ticket['priority'] as string;
    const category = event.ticket['category'] as string;
    const departmentId = event.ticket['departmentId'] as string;
    const creatorId = event.userId;

    this.logger.log(`Notification: ticket créé ${ticketNumber}`);

    // Émettre en temps réel au département propriétaire
    this.wsGateway.emitToDepartment(departmentId, 'ticket.created', {
      ticketId: event.ticket['id'],
      ticketNumber,
      title,
      priority,
      createdBy: creatorId,
    });

    // Émettre aussi aux superviseurs (accès global)
    this.wsGateway.emitToRole('SUPERVISOR', 'ticket.created', {
      ticketId: event.ticket['id'],
      ticketNumber,
      title,
      priority,
    });

    // Email de confirmation au créateur
    const appUrl = process.env['APP_URL'] || 'http://localhost:3000';
    const ticketId = event.ticket['id'] as string;
    const creatorInfo = await this.getUserInfo(creatorId);
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
      const supervisorInfo = await this.getUserInfo(event.assignedBy);
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
          category: ticket?.category ?? 'Non renseigne',
          severity: ticket?.severity ?? 'Non renseigne',
          priority: ticket?.priority ?? 'Non renseigne',
          department: ticket?.department ?? 'Non renseigne',
          slaDueAt: ticket?.slaDueAt ?? 'Non renseigne',
          description: ticket?.description ?? null,
          ticketUrl: `${appUrl}/tickets/${event.ticketId}`,
        },
      });
    }
  }

  @OnEvent('ticket.escalated')
  async handleTicketEscalated(event: TicketEscalatedEvent): Promise<void> {
    this.logger.log(`Notification: ticket ${event.ticketId} escaladé à ${event.escalatedTo}`);

    // WebSocket → utilisateur cible
    this.wsGateway.emitToUser(event.escalatedTo, 'ticket.escalated', {
      ticketId: event.ticketId,
      escalatedBy: event.escalatedBy,
    });

    // WebSocket → tous les superviseurs
    this.wsGateway.emitToRole('SUPERVISOR', 'ticket.escalated', {
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
      const escalatedByInfo = await this.getUserInfo(event.escalatedBy);
      const appUrl = process.env['APP_URL'] || 'http://localhost:3000';
      await this.sendEmail({
        to: escalatedToInfo.email,
        subject: `⚠�? Ticket escaladé — ${ticket?.ticketNumber ?? event.ticketId}`,
        template: 'ticketAssigned',
        data: {
          assigneeName: escalatedToInfo.fullName,
          supervisorName: escalatedByInfo?.fullName ?? 'Un superviseur',
          ticketNumber: ticket?.ticketNumber ?? event.ticketId,
          ticketTitle: ticket?.title ?? 'Sans titre',
          category: ticket?.category ?? 'Non renseigne',
          severity: ticket?.severity ?? 'Non renseigne',
          priority: ticket?.priority ?? 'Non renseigne',
          department: ticket?.department ?? 'Non renseigne',
          slaDueAt: ticket?.slaDueAt ?? 'Non renseigne',
          description: ticket?.description ?? null,
          ticketUrl: `${appUrl}/tickets/${event.ticketId}`,
        },
      });
    }
  }

  @OnEvent('ticket.resolved')
  async handleTicketResolved(event: TicketResolvedEvent): Promise<void> {
    this.logger.log(`Notification: ticket ${event.ticketId} résolu`);

    // Notification WebSocket
    this.wsGateway.emitToUser(event.resolvedBy, 'ticket.resolved', {
      ticketId: event.ticketId,
    });

    // Notification aux superviseurs
    this.wsGateway.emitToRole('SUPERVISOR', 'ticket.resolved', {
      ticketId: event.ticketId,
      resolvedBy: event.resolvedBy,
    });

    // Persistance
    await this.createNotification({
      userId: event.resolvedBy,
      type: 'TICKET_RESOLVED',
      title: 'Ticket résolu',
      message: `Le ticket a été résolu avec succès.`,
      referenceType: 'ticket',
      referenceId: event.ticketId,
    });
  }

  @OnEvent('ticket.reopened')
  async handleTicketReopened(event: TicketReopenedEvent): Promise<void> {
    this.logger.log(`Notification: ticket ${event.ticketId} reouvert par ${event.reopenedBy}`);

    const ticket = await this.drizzle.db
      .select({
        ticketNumber: tickets.ticketNumber,
        assignedTo: tickets.assignedTo,
        departmentId: tickets.departmentId,
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

    // WebSocket → superviseurs
    this.wsGateway.emitToRole('SUPERVISOR', 'ticket.reopened', payload);

    // WebSocket + Notification + Email → assigne
    if (ticket.assignedTo) {
      this.wsGateway.emitToUser(ticket.assignedTo, 'ticket.reopened', payload);

      await this.createNotification({
        userId: ticket.assignedTo,
        type: 'COMMENT_ADDED', // utiliser un type existant ou generic pour eviter les problemes d'enum
        title: `Ticket reouvert — ${ticket.ticketNumber}`,
        message: `Le ticket a ete reouvert par l'agent CS.`,
        referenceType: 'ticket',
        referenceId: event.ticketId,
      });

      const assigneeInfo = await this.getUserInfo(ticket.assignedTo);
      const reopenerInfo = await this.getUserInfo(event.reopenedBy);
      const appUrl = process.env['APP_URL'] || 'http://localhost:3000';
      if (assigneeInfo) {
        await this.sendEmail({
          to: assigneeInfo.email,
          subject: `⚠ Ticket réouvert — ${ticket.ticketNumber}`,
          template: 'ticketAssigned',
          data: {
            assigneeName: assigneeInfo.fullName,
            supervisorName: reopenerInfo?.fullName ?? 'Un agent',
            ticketNumber: ticket.ticketNumber,
            ticketTitle: ticket.title ?? 'Sans titre',
            category: ticket.category ?? 'Non renseigne',
            severity: ticket.severity ?? 'Non renseigne',
            priority: ticket.priority ?? 'Non renseigne',
            department: ticket.department ?? 'Non renseigne',
            slaDueAt: this.formatDateTime(ticket.resolutionDueAt),
            description: ticket.description ?? null,
            ticketUrl: `${appUrl}/tickets/${event.ticketId}`,
          },
        });
      }
    }
  }

  @OnEvent('ticket.status_changed')
  async handleStatusChanged(event: TicketStatusChangedEvent): Promise<void> {
    // Notifier via WS les superviseurs de tout changement de statut
    this.wsGateway.emitToRole('SUPERVISOR', 'ticket.status_changed', {
      ticketId: event.ticketId,
      oldStatus: event.oldStatus,
      newStatus: event.newStatus,
    });
  }

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

    // WS aux Superviseurs
    this.wsGateway.emitToRole('SUPERVISOR', 'ticket.deassigned', payload);

    // WS à l'agent indisponible
    this.wsGateway.emitToUser(event.deassignedAgentId, 'ticket.deassigned', payload);

    // Notification persistante en DB pour l'agent indisponible
    await this.createNotification({
      userId: event.deassignedAgentId,
      type: 'TICKET_ASSIGNED',
      title: `Ticket désassigné d'urgence — ${ticketCtx.ticketNumber}`,
      message: `Vous avez été désassigné de ce ticket. Motif: ${event.reason}`,
      referenceType: 'ticket',
      referenceId: event.ticketId,
    });

    // Envoyer l'email à l'agent
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

    // Trouver les superviseurs du département pour les notifier aussi par mail/notification
    if (event.departmentId) {
      const supervisors = await this.drizzle.db
        .select()
        .from(users)
        .where(and(eq(users.departmentId, event.departmentId), eq(users.role, 'SUPERVISOR'), eq(users.isActive, true)));

      for (const sup of supervisors) {
        // Notification DB
        await this.createNotification({
          userId: sup.id,
          type: 'TICKET_ASSIGNED',
          title: `Alerte Désassignation — ${ticketCtx.ticketNumber}`,
          message: `L'agent ${agentInfo?.fullName ?? 'indisponible'} a été désassigné du ticket. Motif: ${event.reason}`,
          referenceType: 'ticket',
          referenceId: event.ticketId,
        });

        // Email
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
