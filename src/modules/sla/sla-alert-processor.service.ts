/**
 * ============================================================================
 * FICHIER : src/modules/sla/sla-alert-processor.service.ts
 * RÔLE : Moteur d'évaluation et de détection automatique des dépassements de délais SLA.
 * EXPLICATION :
 * Ce service analyse régulièrement les tickets ouverts pour détecter les alertes imminentes et les violations :
 * 1. `process` : Évalue séquentiellement les 4 cas de figure (dépassement réponse, dépassement résolution, alerte réponse <30 min, alerte résolution <30 min).
 * 2. `findCandidates` : Requête les tickets non fermés (`NOT IN ('RESOLVED','CLOSED','CANCELLED')`) et non mis en pause.
 * 3. `claimAlert` : Verrouille l'alerte via une mise à jour SQL atomique (`UPDATE ... RETURNING id`) pour éviter que deux instances parallèles ne traitent le même incident.
 * 4. `releaseAlert` : Réinitialise l'état du ticket si l'envoi de la notification échoue, permettant une nouvelle tentative.
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { and, eq, gte, isNull, lt, notInArray, or, sql, type SQL } from 'drizzle-orm';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { categories, departments, tickets, users } from '../../database/schemas';
import { SlaAlertNotifierService } from './sla-alert-notifier.service';
import { SlaAlertTicket, SlaTarget } from './sla-alert.types';

type AlertKind = 'WARNING' | 'BREACH';

/**
 * Service de traitement des alertes et des violations de contrats de service (SLA).
 */
@Injectable()
export class SlaAlertProcessorService {
  private readonly logger = new Logger(SlaAlertProcessorService.name);
  /** Relance des notifications de violation tant qu'un ticket reste ouvert et en retard (6 h). */
  private static readonly BREACH_REPEAT_INTERVAL_MS = 6 * 60 * 60 * 1000;
  private static readonly CLOSED_STATUSES: Array<typeof tickets.$inferSelect.status> = [
    'RESOLVED',
    'CLOSED',
    'CANCELLED',
  ];

  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly notifier: SlaAlertNotifierService,
  ) {}

  /**
   * Balaye l'ensemble des tickets d'incidents pour appliquer la détection des alertes et retards SLA.
   */
  async process(): Promise<void> {
    const now = new Date();
    const warningThreshold = new Date(now.getTime() + 30 * 60 * 1000); // Seuil d'avertissement fixé à 30 minutes

    await this.processTarget('FIRST_RESPONSE', 'BREACH', now, warningThreshold);
    await this.processTarget('RESOLUTION', 'BREACH', now, warningThreshold);
    await this.processTarget('FIRST_RESPONSE', 'WARNING', now, warningThreshold);
    await this.processTarget('RESOLUTION', 'WARNING', now, warningThreshold);
  }

  /**
   * Recherche et traite les tickets candidats pour un type d'alerte donné.
   */
  private async processTarget(target: SlaTarget, kind: AlertKind, now: Date, threshold: Date): Promise<void> {
    const candidates = await this.findCandidates(target, kind, now, threshold);

    for (const ticket of candidates) {
      const claimed = await this.claimAlert(ticket.id, target, kind, now, threshold);
      if (!claimed) continue;

      try {
        this.logger.warn(`${kind} SLA ${target}: ${ticket.ticketNumber}`);
        if (kind === 'BREACH') {
          await this.notifier.notifyBreach(ticket, target, now);
        } else {
          await this.notifier.notifyWarning(ticket, target, now);
        }
      } catch (error: unknown) {
        await this.releaseAlert(ticket.id, target, kind);
        this.logger.error(`Alerte SLA ${target}/${kind} libérée pour retry: ${String(error)}`);
      }
    }
  }

  /**
   * Extrait jusqu'à 100 tickets éligibles à un avertissement ou une pénalité SLA.
   */
  private async findCandidates(
    target: SlaTarget,
    kind: AlertKind,
    now: Date,
    threshold: Date,
  ): Promise<SlaAlertTicket[]> {
    const dueAt = target === 'FIRST_RESPONSE' ? tickets.firstResponseDueAt : tickets.resolutionDueAt;
    const warningSentAt =
      target === 'FIRST_RESPONSE' ? tickets.firstResponseWarningSentAt : tickets.resolutionWarningSentAt;
    const breachedAt = target === 'FIRST_RESPONSE' ? tickets.firstResponseBreachedAt : tickets.resolutionBreachedAt;
    const conditions: Array<SQL | undefined> = [
      isNull(tickets.deletedAt),
      notInArray(tickets.status, SlaAlertProcessorService.CLOSED_STATUSES),
    ];

    if (target === 'FIRST_RESPONSE') {
      conditions.push(isNull(tickets.firstResponseAt));
    } else {
      conditions.push(isNull(tickets.slaPausedAt));
    }

    if (kind === 'BREACH') {
      const breachCandidate = or(
        isNull(breachedAt),
        lt(
            sql`COALESCE((${tickets.metadata}->>${this.breachNotifiedKeySql(target)})::timestamptz, to_timestamp(0))`,
          new Date(now.getTime() - SlaAlertProcessorService.BREACH_REPEAT_INTERVAL_MS).toISOString(),
        ),
      );
      conditions.push(
        lt(dueAt, now),
        // Première violation, ou relance périodique si la dernière notification est ancienne.
        breachCandidate,
      );
    } else {
      conditions.push(isNull(warningSentAt), gte(dueAt, now), lt(dueAt, threshold));
    }

    return this.drizzle.db
      .select({
        id: tickets.id,
        ticketNumber: tickets.ticketNumber,
        title: tickets.title,
        priority: tickets.priority,
        status: tickets.status,
        severity: tickets.severity,
        categoryName: categories.name,
        departmentName: departments.name,
        departmentId: tickets.assignedTeamId,
        assignedTo: tickets.assignedTo,
        dueAt,
        assigneeEmail: users.email,
        assigneeFirstName: users.firstName,
        assigneeLastName: users.lastName,
      })
      .from(tickets)
      .leftJoin(users, eq(tickets.assignedTo, users.id))
      .leftJoin(departments, eq(tickets.departmentId, departments.id))
      .leftJoin(categories, eq(tickets.categoryId, categories.id))
      .where(and(...conditions))
      .limit(100);
  }

  /**
   * Revendique de manière atomique l'alerte sur un ticket en mettant à jour son horodatage.
   */
  private async claimAlert(
    id: string,
    target: SlaTarget,
    kind: AlertKind,
    now: Date,
    threshold: Date,
  ): Promise<boolean> {
    const dueAt = target === 'FIRST_RESPONSE' ? tickets.firstResponseDueAt : tickets.resolutionDueAt;
    const activeConditions = [
      eq(tickets.id, id),
      isNull(tickets.deletedAt),
      notInArray(tickets.status, SlaAlertProcessorService.CLOSED_STATUSES),
      target === 'FIRST_RESPONSE' ? isNull(tickets.firstResponseAt) : isNull(tickets.slaPausedAt),
      kind === 'BREACH' ? lt(dueAt, now) : and(gte(dueAt, now), lt(dueAt, threshold)),
    ];

    if (target === 'FIRST_RESPONSE' && kind === 'BREACH') {
      // Première violation : horodate la rupture, marque le ticket et mémorise l'envoi.
      const rows = await this.drizzle.db
        .update(tickets)
        .set({
          firstResponseBreachedAt: now,
          slaBreached: true,
          metadata: this.breachNotifiedMetadataSql(target, now),
        })
        .where(and(...activeConditions, isNull(tickets.firstResponseBreachedAt)))
        .returning({ id: tickets.id });
      if (rows.length > 0) return true;
      // Relance périodique : ticket déjà en rupture, on renvoie une alerte.
      const repeatRows = await this.drizzle.db
        .update(tickets)
        .set({ metadata: this.breachNotifiedMetadataSql(target, now) })
        .where(
          and(
            eq(tickets.id, id),
            isNull(tickets.deletedAt),
            notInArray(tickets.status, SlaAlertProcessorService.CLOSED_STATUSES),
            isNull(tickets.firstResponseAt),
            lt(dueAt, now),
            sql`${tickets.firstResponseBreachedAt} IS NOT NULL`,
            lt(
              sql`COALESCE((${tickets.metadata}->>${this.breachNotifiedKeySql(target)})::timestamptz, to_timestamp(0))`,
              new Date(now.getTime() - SlaAlertProcessorService.BREACH_REPEAT_INTERVAL_MS).toISOString(),
            ),
          ),
        )
        .returning({ id: tickets.id });
      return repeatRows.length > 0;
    }

    if (target === 'RESOLUTION' && kind === 'BREACH') {
      const rows = await this.drizzle.db
        .update(tickets)
        .set({
          resolutionBreachedAt: now,
          slaBreached: true,
          metadata: this.breachNotifiedMetadataSql(target, now),
        })
        .where(and(...activeConditions, isNull(tickets.resolutionBreachedAt)))
        .returning({ id: tickets.id });
      if (rows.length > 0) return true;
      const repeatRows = await this.drizzle.db
        .update(tickets)
        .set({ metadata: this.breachNotifiedMetadataSql(target, now) })
        .where(
          and(
            eq(tickets.id, id),
            isNull(tickets.deletedAt),
            notInArray(tickets.status, SlaAlertProcessorService.CLOSED_STATUSES),
            isNull(tickets.slaPausedAt),
            lt(dueAt, now),
            sql`${tickets.resolutionBreachedAt} IS NOT NULL`,
            lt(
              sql`COALESCE((${tickets.metadata}->>${this.breachNotifiedKeySql(target)})::timestamptz, to_timestamp(0))`,
              new Date(now.getTime() - SlaAlertProcessorService.BREACH_REPEAT_INTERVAL_MS).toISOString(),
            ),
          ),
        )
        .returning({ id: tickets.id });
      return repeatRows.length > 0;
    }

    if (target === 'FIRST_RESPONSE') {
      const rows = await this.drizzle.db
        .update(tickets)
        .set({ firstResponseWarningSentAt: now })
        .where(and(...activeConditions, isNull(tickets.firstResponseWarningSentAt)))
        .returning({ id: tickets.id });
      return rows.length > 0;
    }

    const rows = await this.drizzle.db
      .update(tickets)
      .set({ resolutionWarningSentAt: now })
      .where(and(...activeConditions, isNull(tickets.resolutionWarningSentAt)))
      .returning({ id: tickets.id });
    return rows.length > 0;
  }

  /**
   * Libère le statut d'alerte d'un ticket en cas d'erreur de traitement pour permettre un réessai.
   */
  private async releaseAlert(id: string, target: SlaTarget, kind: AlertKind): Promise<void> {
    if (kind === 'WARNING') {
      const warningField = target === 'FIRST_RESPONSE' ? 'firstResponseWarningSentAt' : 'resolutionWarningSentAt';
      await this.drizzle.db
        .update(tickets)
        .set({ [warningField]: null })
        .where(eq(tickets.id, id));
      return;
    }

    if (target === 'FIRST_RESPONSE') {
      await this.drizzle.db
        .update(tickets)
        .set({
          firstResponseBreachedAt: null,
          slaBreached: sql`${tickets.resolutionBreachedAt} IS NOT NULL`,
          metadata: this.removeBreachNotifiedMetadataSql('FIRST_RESPONSE'),
        })
        .where(eq(tickets.id, id));
      return;
    }
    await this.drizzle.db
      .update(tickets)
      .set({
        resolutionBreachedAt: null,
        slaBreached: sql`${tickets.firstResponseBreachedAt} IS NOT NULL`,
        metadata: this.removeBreachNotifiedMetadataSql('RESOLUTION'),
      })
      .where(eq(tickets.id, id));
  }

  /** Clé JSONB utilisée pour mémoriser la dernière notification de violation d'un objectif SLA. */
  private breachNotifiedKey(target: SlaTarget): string {
    return target === 'FIRST_RESPONSE' ? 'firstResponseBreachNotifiedAt' : 'resolutionBreachNotifiedAt';
  }

  /** SQL JSONB : écrit l'horodatage de la dernière notification de violation. */
  private breachNotifiedMetadataSql(target: SlaTarget, now: Date) {
    return sql`COALESCE(${tickets.metadata}, '{}'::jsonb) || jsonb_build_object(${this.breachNotifiedKeySql(
      target,
    )}, to_jsonb(${now.toISOString()}::timestamptz))`;
  }

  /** SQL JSONB : retire l'horodatage de notification lors d'un retry. */
  private removeBreachNotifiedMetadataSql(target: SlaTarget) {
    return sql`COALESCE(${tickets.metadata}, '{}'::jsonb) - ${this.breachNotifiedKeySql(target)}`;
  }

  /** Clé JSONB inlinée en littéral SQL (constante interne, jamais issue d'une entrée utilisateur). */
  private breachNotifiedKeySql(target: SlaTarget) {
    return sql.raw(`'${this.breachNotifiedKey(target)}'`);
  }
}
