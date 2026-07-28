import { Injectable, Logger } from '@nestjs/common';
import { and, eq, gte, isNull, lt, notInArray, sql } from 'drizzle-orm';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { categories, departments, tickets, users } from '../../database/schemas';
import { SlaAlertNotifierService } from './sla-alert-notifier.service';
import { SlaAlertTicket, SlaTarget } from './sla-alert.types';

type AlertKind = 'WARNING' | 'BREACH';

@Injectable()
export class SlaAlertProcessorService {
  private readonly logger = new Logger(SlaAlertProcessorService.name);
  private static readonly CLOSED_STATUSES: Array<typeof tickets.$inferSelect.status> = [
    'RESOLVED',
    'CLOSED',
    'CANCELLED',
  ];

  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly notifier: SlaAlertNotifierService,
  ) {}

  async process(): Promise<void> {
    const now = new Date();
    const warningThreshold = new Date(now.getTime() + 30 * 60 * 1000);

    await this.processTarget('FIRST_RESPONSE', 'BREACH', now, warningThreshold);
    await this.processTarget('RESOLUTION', 'BREACH', now, warningThreshold);
    await this.processTarget('FIRST_RESPONSE', 'WARNING', now, warningThreshold);
    await this.processTarget('RESOLUTION', 'WARNING', now, warningThreshold);
  }

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
    const conditions = [
      isNull(tickets.deletedAt),
      isNull(breachedAt),
      notInArray(tickets.status, SlaAlertProcessorService.CLOSED_STATUSES),
    ];

    if (target === 'FIRST_RESPONSE') {
      conditions.push(isNull(tickets.firstResponseAt));
    } else {
      conditions.push(isNull(tickets.slaPausedAt));
    }
    if (kind === 'BREACH') {
      conditions.push(lt(dueAt, now));
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

  private async claimAlert(
    id: string,
    target: SlaTarget,
    kind: AlertKind,
    now: Date,
    threshold: Date,
  ): Promise<boolean> {
    const dueAt = target === 'FIRST_RESPONSE' ? tickets.firstResponseDueAt : tickets.resolutionDueAt;
    const breachedAt = target === 'FIRST_RESPONSE' ? tickets.firstResponseBreachedAt : tickets.resolutionBreachedAt;
    const activeConditions = [
      eq(tickets.id, id),
      isNull(tickets.deletedAt),
      isNull(breachedAt),
      notInArray(tickets.status, SlaAlertProcessorService.CLOSED_STATUSES),
      target === 'FIRST_RESPONSE' ? isNull(tickets.firstResponseAt) : isNull(tickets.slaPausedAt),
      kind === 'BREACH' ? lt(dueAt, now) : and(gte(dueAt, now), lt(dueAt, threshold)),
    ];

    if (target === 'FIRST_RESPONSE' && kind === 'BREACH') {
      const rows = await this.drizzle.db
        .update(tickets)
        .set({ firstResponseBreachedAt: now, slaBreached: true })
        .where(and(...activeConditions))
        .returning({ id: tickets.id });
      return rows.length > 0;
    }
    if (target === 'RESOLUTION' && kind === 'BREACH') {
      const rows = await this.drizzle.db
        .update(tickets)
        .set({ resolutionBreachedAt: now, slaBreached: true })
        .where(and(...activeConditions))
        .returning({ id: tickets.id });
      return rows.length > 0;
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
        .set({ firstResponseBreachedAt: null, slaBreached: sql`${tickets.resolutionBreachedAt} IS NOT NULL` })
        .where(eq(tickets.id, id));
      return;
    }
    await this.drizzle.db
      .update(tickets)
      .set({ resolutionBreachedAt: null, slaBreached: sql`${tickets.firstResponseBreachedAt} IS NOT NULL` })
      .where(eq(tickets.id, id));
  }
}
