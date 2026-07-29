/**
 * ============================================================================
 * FICHIER : src/modules/tickets/services/auto-assignment.cron.ts
 * RÔLE : Tâche planifiée (Cron Job) d'auto-assignation, routage et consolidation de la charge.
 * EXPLICATION :
 * Ce composant s'exécute automatiquement toutes les 2 minutes en arrière-plan :
 * 1. Rafraîchit de manière concurrente la vue matérialisée `materialized_workload_view` PostgreSQL.
 * 2. Réactive automatiquement les agents dont la période d'absence planifiée (`absenceEndsAt`) est expirée.
 * 3. Ré-attribue ou désassigne les tickets bloqués sur des agents désactivés ou absents lorsque l'échéance SLA approche (< 1 heure restante).
 * 4. Dépile les tickets en attente d'assignation (`NEW`, `REOPENED`) triés par priorité (CRITICAL → LOW) et sévérité (S1 → S4), puis les achemine par lots de 10 via `AssignmentEngineService`.
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { eq, and, isNull, or, inArray, sql, lte, gt } from 'drizzle-orm';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { tickets, users, ticketHistory } from '../../../database/schemas';
import { AssignmentEngineService } from './assignment-engine.service';
import { generateUuid } from '../../../common/helpers/uuidv7.helper';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * Service gérant le cycle de planification et d'acheminement automatique des tickets télécom.
 */
@Injectable()
export class AutoAssignmentCron {
  private readonly logger = new Logger(AutoAssignmentCron.name);
  private isProcessing = false;

  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly assignmentEngine: AssignmentEngineService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Job principal d'assignation automatique exécuté toutes les 2 minutes par `@nestjs/schedule`.
   */

  @Cron('*/2 * * * *')
  async runAutoAssignment(): Promise<void> {
    if (this.isProcessing) {
      this.logger.debug("Auto-assignation déjà en cours d'exécution. Passage.");
      return;
    }

    this.isProcessing = true;
    this.logger.log("Démarrage du job d'auto-assignation et de consolidation...");

    try {
      // 1. Rafraîchir la vue matérialisée du workload si elle existe (sécurisé)
      const [viewExists] = await this.drizzle.db.execute(
        sql`SELECT EXISTS (SELECT FROM pg_matviews WHERE matviewname = 'materialized_workload_view')`,
      );
      const exists =
        (viewExists as Record<string, unknown>)?.exists === true ||
        (Array.isArray(viewExists) && (viewExists[0] as Record<string, unknown>)?.exists === true);

      if (exists) {
        await this.drizzle.db
          .execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY materialized_workload_view`)
          .catch((err) => {
            this.logger.warn(`Impossible de rafraichir la vue matérialisée: ${String(err)}`);
          });
      } else {
        this.logger.debug(
          "La vue matérialisée materialized_workload_view n'existe pas en base. Rafraîchissement ignoré.",
        );
      }

      // 2. Gérer le retour d'absence des agents (absenceEndsAt expiré)
      const now = new Date();
      const expiredAbsences = await this.drizzle.db
        .update(users)
        .set({
          isAvailable: true,
          absenceEndsAt: null,
        })
        .where(and(eq(users.isActive, true), lte(users.absenceEndsAt, now)))
        .returning({ id: users.id, email: users.email });

      for (const agent of expiredAbsences) {
        this.logger.log(`Agent ${agent.email} de retour d'absence. Remis en disponibilité automatique.`);
      }

      // 3. Gérer les indisponibilités / absences prolongées et déloguer proprement si risque SLA
      await this.consolidateInactiveAgentsWorkload(now);

      // 4. Traiter les tickets non assignés en lots (critiques en premier)
      const unassignedTickets = await this.drizzle.db
        .select({ id: tickets.id, ticketNumber: tickets.ticketNumber })
        .from(tickets)
        .where(
          and(
            isNull(tickets.assignedTo),
            inArray(tickets.status, ['NEW', 'REOPENED'] as Array<typeof tickets.$inferSelect.status>),
            isNull(tickets.deletedAt),
          ),
        )
        .orderBy(
          sql`case ${tickets.priority} when 'CRITICAL' then 4 when 'HIGH' then 3 when 'MEDIUM' then 2 when 'LOW' then 1 else 0 end desc`,
          sql`case ${tickets.severity} when 'S1' then 4 when 'S2' then 3 when 'S3' then 2 when 'S4' then 1 else 0 end desc`,
          tickets.createdAt,
        )
        .limit(50); // LIMIT pour ne pas exploser la DB

      if (unassignedTickets.length > 0) {
        this.logger.log(
          `Traitement de ${unassignedTickets.length} tickets non assignés en parallèle par groupes de 10...`,
        );

        // Traiter en parallèle par blocs de 10
        const batchSize = 10;
        for (let i = 0; i < unassignedTickets.length; i += batchSize) {
          const batch = unassignedTickets.slice(i, i + batchSize);
          await Promise.all(
            batch.map(async (t) => {
              await this.assignmentEngine.routeTicket(t.id);
            }),
          );
        }
      }

      this.logger.log("Job d'auto-assignation et de consolidation complété.");
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Erreur lors du traitement d'auto-assignation périodique : ${errMsg}`, errStack);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Consolidation de la charge des agents indisponibles ou absents.
   * Désassignation uniquement en cas d'absence prolongée ou de risque réel d'expiration de SLA.
   */
  private async consolidateInactiveAgentsWorkload(now: Date): Promise<void> {
    // 1. Trouver les agents inactifs ou indisponibles (ou en absence déclarée)
    const inactiveAgents = await this.drizzle.db
      .select()
      .from(users)
      .where(or(eq(users.isActive, false), eq(users.isAvailable, false), gt(users.absenceEndsAt, now)));

    if (inactiveAgents.length === 0) return;

    // Récupérer leurs tickets actifs assignés
    const activeTickets = await this.drizzle.db
      .select({
        id: tickets.id,
        ticketNumber: tickets.ticketNumber,
        status: tickets.status,
        priority: tickets.priority,
        assignedTo: tickets.assignedTo,
        resolutionDueAt: tickets.resolutionDueAt,
        firstResponseDueAt: tickets.firstResponseDueAt,
        firstResponseAt: tickets.firstResponseAt,
      })
      .from(tickets)
      .where(
        and(
          inArray(
            tickets.assignedTo,
            // La guard `if (inactiveAgents.length === 0) return` ci-dessus garantit que ce tableau n'est jamais vide
            inactiveAgents.map((a) => a.id),
          ),
          inArray(tickets.status, [
            'ASSIGNED',
            'IN_PROGRESS',
            'PENDING_CUSTOMER',
            'PENDING_THIRD_PARTY',
            'REOPENED',
          ] as Array<typeof tickets.$inferSelect.status>),
          isNull(tickets.deletedAt),
        ),
      );

    if (activeTickets.length === 0) return;

    const [systemUser] = await this.drizzle.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, 'admin@telecom.local'))
      .limit(1);
    const systemUserId = systemUser?.id;

    for (const ticket of activeTickets) {
      const agent = inactiveAgents.find((a) => a.id === ticket.assignedTo);
      if (!agent) continue;

      let shouldDeassign = false;
      let reason = '';

      // Règle 1: Si l'agent est inactif en base (compte désactivé) -> désassignation immédiate
      if (!agent.isActive) {
        shouldDeassign = true;
        reason = `Compte de l'agent désactivé (${agent.email})`;
      }
      // Règle 2: Si l'agent a une absence planifiée de plus de 24h -> désassignation immédiate
      else if (agent.absenceEndsAt) {
        const absenceDurationMs = new Date(agent.absenceEndsAt).getTime() - now.getTime();
        if (absenceDurationMs > 24 * 60 * 60 * 1000) {
          shouldDeassign = true;
          reason = `Absence prolongée planifiée de l'agent de plus de 24 heures (Fin: ${agent.absenceEndsAt.toLocaleString('fr-FR')})`;
        }
      }
      // Règle 3: Si l'agent est simplement hors ligne (isAvailable = false) -> désassignation uniquement si risque SLA
      else if (!agent.isAvailable) {
        // Vérifier si le SLA de résolution ou de premier contact approche de l'échéance (< 15% restants ou < 1 heure restants)
        const checkTargetDate = ticket.firstResponseAt ? ticket.resolutionDueAt : ticket.firstResponseDueAt;
        if (checkTargetDate) {
          const dueTime = new Date(checkTargetDate).getTime();
          const timeLeftMs = dueTime - now.getTime();

          // Si expiré ou moins de 1 heure restante, on désassigne
          if (timeLeftMs <= 0 || timeLeftMs < 60 * 60 * 1000) {
            shouldDeassign = true;
            reason = `Risque d'expiration de SLA imminent (< 1h) alors que l'agent est indisponible.`;
          }
        }
      }

      if (shouldDeassign) {
        this.logger.log(
          `Désassignation automatique du ticket ${ticket.ticketNumber} de l'agent indisponible ${agent.email}. Motif: ${reason}`,
        );

        // Désassignation atomique
        await this.drizzle.db
          .update(tickets)
          .set({
            assignedTo: null,
            status: ticket.status === 'NEW' ? 'NEW' : 'REOPENED', // Repasse en NEW ou REOPENED pour aiguillage
            updatedAt: now,
          })
          .where(eq(tickets.id, ticket.id));

        // Enregistrer l'historique
        await this.drizzle.db.insert(ticketHistory).values({
          id: generateUuid(),
          ticketId: ticket.id,
          userId: systemUserId || agent.id,
          action: 'STATUS_CHANGED',
          oldValue: { assignedTo: agent.id, status: ticket.status },
          newValue: { assignedTo: null, status: 'REOPENED' },
          metadata: { reason: `Désassignation automatique système : ${reason}` },
        });

        // Émettre un événement pour forcer le ré-aiguillage asynchrone immédiat
        this.eventEmitter.emit('ticket.unassigned', {
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
        });

        // Émettre l'événement de désassignation pour envoyer notifications et e-mails
        const { TicketDeassignedEvent } = await import('../domain/ticket.events');
        this.eventEmitter.emit(
          'ticket.deassigned',
          new TicketDeassignedEvent(ticket.id, agent.id, reason, agent.departmentId || ''),
        );
      }
    }
  }
}
