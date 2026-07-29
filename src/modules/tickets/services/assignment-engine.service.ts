/**
 * ============================================================================
 * FICHIER : src/modules/tickets/services/assignment-engine.service.ts
 * RÔLE : Moteur d'assignation et de routage automatique des tickets d'incidents aux agents télécoms.
 * EXPLICATION :
 * Ce service gère l'attribution intelligente et équitable des tickets entrants aux agents disponibles :
 * 1. `routeTicket` : Transaction PostgreSQL avec verrous pessimistes (`SELECT FOR UPDATE`) prévenant toute concurrence d'assignation.
 * 2. Stratégies d'assignation : `ROUND_ROBIN` (sélectionne l'agent avec le plus ancien `lastAssignedAt`) ou `LEAST_LOADED` (sélectionne l'agent avec le score de charge pondéré le plus bas).
 * 3. Contrôles de capacité : Exclut les agents indisponibles/absents et ceux ayant atteint leur limite de tickets simultanés (`maxConcurrentTickets`) ou de charge globale (`maxWorkloadPerAgent`).
 * 4. Poids et rôle technique : Applique des pénalités de charge virtuelles si le rôle de l'agent ne correspond pas au `targetRole` configuré sur la catégorie de l'incident.
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { eq, and, isNull, or, inArray, lte, notInArray } from 'drizzle-orm';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { tickets, users, departments, ticketAssignments, ticketHistory, categories } from '../../../database/schemas';
import { generateUuid } from '../../../common/helpers/uuidv7.helper';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TicketAssignedEvent } from '../domain/ticket.events';
import { SettingsService } from '../../settings/settings.service';

/**
 * Configuration de pondération de la charge de travail par ticket.
 * Correspond au champ JSONB `workload_weights` de la table `departments`.
 */
interface WorkloadWeightsConfig {
  priority?: Record<string, number>;
  severity?: Record<string, number>;
}

function isWorkloadWeightsConfig(value: unknown): value is WorkloadWeightsConfig {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  const isPriorityValid = v['priority'] === undefined || (typeof v['priority'] === 'object' && v['priority'] !== null);
  const isSeverityValid = v['severity'] === undefined || (typeof v['severity'] === 'object' && v['severity'] !== null);
  return isPriorityValid && isSeverityValid;
}

/**
 * Service gérant les règles métier et l'algorithme d'assignation automatique des incidents.
 */
@Injectable()
export class AssignmentEngineService {
  private readonly logger = new Logger(AssignmentEngineService.name);

  // Statuts considérés comme "actifs" pour calculer la charge en cours d'un agent.
  private static readonly ACTIVE_STATUSES: ReadonlyArray<typeof tickets.$inferSelect.status> = [
    'ASSIGNED',
    'IN_PROGRESS',
    'PENDING_CUSTOMER',
    'PENDING_THIRD_PARTY',
    'REOPENED',
  ];

  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly eventEmitter: EventEmitter2,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Tente d'assigner automatiquement un ticket à l'agent le plus qualifié et le moins chargé du département.
   *
   * @param ticketId UUID du ticket à router.
   * @returns `true` si le ticket a été assigné avec succès, `false` sinon.
   */
  async routeTicket(ticketId: string): Promise<boolean> {
    try {
      return await this.drizzle.db.transaction(async (tx) => {
        // 1. Verrouiller le ticket pour lecture et modification exclusive
        const [ticket] = await tx
          .select()
          .from(tickets)
          .where(and(eq(tickets.id, ticketId), isNull(tickets.deletedAt)))
          .for('update'); // SELECT FOR UPDATE

        if (!ticket) {
          this.logger.warn(`Tentative de routage d'un ticket inexistant ou supprimé : ${ticketId}`);
          return false;
        }

        // Si le ticket est déjà assigné ou résolu/clos, on ne fait rien
        if (ticket.assignedTo || !['NEW', 'REOPENED'].includes(ticket.status)) {
          this.logger.debug(
            `Le ticket ${ticket.ticketNumber} est déjà assigné ou n'est plus à assigner (statut: ${ticket.status})`,
          );
          return false;
        }

        // 2. Récupérer le département et sa configuration d'assignation
        const [dept] = await tx.select().from(departments).where(eq(departments.id, ticket.assignedTeamId)).limit(1);

        if (!dept) {
          this.logger.error(
            `Département assigné introuvable (${ticket.assignedTeamId}) pour le ticket ${ticket.ticketNumber}`,
          );
          return false;
        }

        if (!dept.autoAssignmentEnabled) {
          this.logger.log(`Assignation automatique désactivée pour le département ${dept.name}`);
          return false;
        }

        // 3. Trouver les agents du département éligibles (actifs et disponibles)
        const now = new Date();
        const eligibleAgents = await tx
          .select()
          .from(users)
          .where(
            and(
              eq(users.departmentId, dept.id),
              eq(users.isActive, true),
              eq(users.isAvailable, true),
              notInArray(users.role, ['ADMINISTRATOR', 'SUPERVISOR']),
              or(isNull(users.absenceEndsAt), lte(users.absenceEndsAt, now)),
            ),
          );

        if (eligibleAgents.length === 0) {
          this.logger.warn(
            `Aucun agent disponible dans le département ${dept.name} pour le ticket ${ticket.ticketNumber}`,
          );
          return false;
        }

        // 4. Calculer la charge et filtrer par capacité pour chaque agent
        const candidates: Array<{ agent: typeof users.$inferSelect; activeCount: number; workloadScore: number }> = [];

        // Récupérer tous les tickets actifs pour ces agents dans le département
        const activeTickets = await tx
          .select()
          .from(tickets)
          .where(
            and(
              inArray(
                tickets.assignedTo,
                eligibleAgents.map((a) => a.id),
              ),
              inArray(tickets.status, [...AssignmentEngineService.ACTIVE_STATUSES]),
              isNull(tickets.deletedAt),
            ),
          );

        const [ticketCat] = await tx.select().from(categories).where(eq(categories.id, ticket.categoryId)).limit(1);

        const targetRole = ticketCat ? ticketCat.targetRole : null;

        for (const agent of eligibleAgents) {
          // Filtrer les tickets actifs de cet agent
          const agentTickets = activeTickets.filter((t) => t.assignedTo === agent.id);
          const activeCount = agentTickets.length;

          // Si l'agent a atteint ou dépassé sa limite de tickets actifs concomitants, on l'exclut
          const maxConcurrentGlobal = await this.settingsService.getMaxConcurrentTickets();
          const maxConcurrentLimit = agent.maxConcurrentTickets ?? maxConcurrentGlobal;

          if (activeCount >= maxConcurrentLimit) {
            continue;
          }

          // Calculer le score de charge pondéré
          const weightsConfig = isWorkloadWeightsConfig(dept.workloadWeights) ? dept.workloadWeights : undefined;
          const workloadScore = this.calculateWorkloadScore(agentTickets, weightsConfig);

          // Si le score de charge dépasse la limite du département, on l'exclut
          if (workloadScore >= dept.maxWorkloadPerAgent) {
            continue;
          }

          // Bonus de correspondance de rôle implicite
          let roleMatchPenalty = 0;
          if (targetRole && agent.role !== targetRole) {
            // L'agent n'a pas le rôle technique idéal, on lui applique une pénalité virtuelle de charge
            // pour privilégier les agents spécialisés dans cette catégorie
            roleMatchPenalty = 20;
          }

          candidates.push({
            agent,
            activeCount,
            workloadScore: workloadScore + roleMatchPenalty,
          });
        }

        if (candidates.length === 0) {
          this.logger.warn(
            `Tous les agents du département ${dept.name} sont saturés (maxConcurrentTickets ou maxWorkload atteint).`,
          );
          return false;
        }

        // 5. Sélectionner le meilleur agent selon la stratégie du département
        let selectedAgent: typeof users.$inferSelect;

        if (dept.assignmentStrategy === 'ROUND_ROBIN') {
          // Trier par lastAssignedAt ascendant (le plus anciennement assigné d'abord)
          candidates.sort((a, b) => {
            const dateA = a.agent.lastAssignedAt ? new Date(a.agent.lastAssignedAt).getTime() : 0;
            const dateB = b.agent.lastAssignedAt ? new Date(b.agent.lastAssignedAt).getTime() : 0;
            return dateA - dateB;
          });
          selectedAgent = candidates[0].agent;
        } else {
          // LEAST_LOADED (Défaut) : Trier par workloadScore ascendant, puis lastAssignedAt ascendant
          candidates.sort((a, b) => {
            if (a.workloadScore !== b.workloadScore) {
              return a.workloadScore - b.workloadScore;
            }
            const dateA = a.agent.lastAssignedAt ? new Date(a.agent.lastAssignedAt).getTime() : 0;
            const dateB = b.agent.lastAssignedAt ? new Date(b.agent.lastAssignedAt).getTime() : 0;
            return dateA - dateB;
          });
          selectedAgent = candidates[0].agent;
        }

        // 6. Verrouiller l'agent sélectionné
        await tx.select().from(users).where(eq(users.id, selectedAgent.id)).for('update');

        // Trouver l'administrateur système pour l'imputation de l'assignation
        const [systemUser] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, 'admin@telecom.local'))
          .limit(1);

        const systemUserId = systemUser?.id || selectedAgent.id;

        // 7. Appliquer l'assignation
        await tx
          .update(tickets)
          .set({
            assignedTo: selectedAgent.id,
            status: 'ASSIGNED',
            updatedAt: now,
          })
          .where(eq(tickets.id, ticket.id));

        // Mettre à jour lastAssignedAt de l'agent
        await tx.update(users).set({ lastAssignedAt: now }).where(eq(users.id, selectedAgent.id));

        // Enregistrer l'assignation dans ticket_assignments
        await tx.insert(ticketAssignments).values({
          id: generateUuid(),
          ticketId: ticket.id,
          fromUserId: null,
          toUserId: selectedAgent.id,
          fromDepartmentId: null,
          toDepartmentId: dept.id,
          assignedBy: systemUserId,
          reason: `Assignation automatique par le système (Stratégie: ${dept.assignmentStrategy})`,
          createdAt: now,
        });

        // Enregistrer dans l'historique du ticket
        await tx.insert(ticketHistory).values({
          id: generateUuid(),
          ticketId: ticket.id,
          userId: systemUserId,
          action: 'TICKET_ASSIGNED',
          oldValue: null,
          newValue: { assignedTo: selectedAgent.id, status: 'ASSIGNED' },
          metadata: {
            reason: `Assignation automatique à ${selectedAgent.firstName} ${selectedAgent.lastName} (${selectedAgent.role})`,
          },
        });

        this.logger.log(`Ticket ${ticket.ticketNumber} assigné automatiquement à l'agent ${selectedAgent.email}`);

        // 8. Émettre l'événement sémantique
        this.eventEmitter.emit('ticket.assigned', new TicketAssignedEvent(ticket.id, selectedAgent.id, systemUserId));

        return true;
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Erreur fatale lors du routage automatique du ticket ${ticketId} : ${errMsg}`, errStack);
      return false;
    }
  }

  /**
   * Calcule le score de charge pondéré cumulé pour l'ensemble des tickets actifs gérés par un agent.
   *
   * @param agentTickets Liste des tickets actuellement en cours d'un agent.
   * @param weightsConfig Matrice facultative de pondération par priorité et sévérité.
   * @returns Le score de charge numérique cumulé.
   */
  private calculateWorkloadScore(
    agentTickets: Array<typeof tickets.$inferSelect>,
    weightsConfig?: WorkloadWeightsConfig,
  ): number {
    // Poids par défaut
    const defaultPriorityWeights: Record<string, number> = {
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
      CRITICAL: 5,
    };

    const defaultSeverityWeights: Record<string, number> = {
      S4: 1,
      S3: 2,
      S2: 3,
      S1: 5,
    };

    const priorityWeights = weightsConfig?.priority || defaultPriorityWeights;
    const severityWeights = weightsConfig?.severity || defaultSeverityWeights;

    let totalScore = 0;
    for (const t of agentTickets) {
      const pWeight = priorityWeights[t.priority] ?? 1;
      const sWeight = severityWeights[t.severity] ?? 1;
      // Le score cumulé par ticket est la somme des poids de priorité et sévérité
      totalScore += pWeight + sWeight;
    }

    return totalScore;
  }
}
