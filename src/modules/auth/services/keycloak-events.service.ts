/**
 * Synchronisation des événements Keycloak vers la piste d'audit immuable.
 * - Cron toutes les 5 minutes (désactivable via KEYCLOAK_EVENTS_SYNC_CRON=disabled).
 * - Déduplication garantie par l'index unique partiel sur `audit_logs.source_event_id`.
 * - Les événements non mappables (sujet Keycloak sans profil métier) sont ignorés.
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { eq } from 'drizzle-orm';

import { DrizzleProvider } from '../../../database/drizzle.provider';
import { users } from '../../../database/schemas';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { systemActor } from '../../tickets/domain/ticket-actor';
import { KeycloakAdminService } from './keycloak-admin.service';

interface KeycloakEvent {
  readonly id?: string;
  readonly userId?: string;
  readonly type?: string;
  readonly ipAddress?: string;
  readonly clientId?: string;
  readonly details?: Record<string, unknown> | null;
}

@Injectable()
export class KeycloakEventsService {
  private readonly logger = new Logger(KeycloakEventsService.name);

  constructor(
    private readonly keycloakAdmin: KeycloakAdminService,
    private readonly auditLogs: AuditLogsService,
    private readonly drizzle: DrizzleProvider,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async sync(): Promise<void> {
    if (process.env['KEYCLOAK_EVENTS_SYNC_CRON'] === 'disabled') return;

    let events: KeycloakEvent[];
    try {
      events = await this.keycloakAdmin.listEvents(100);
    } catch (error) {
      this.logger.error(
        'Synchronisation des événements Keycloak impossible',
        error instanceof Error ? error.message : String(error),
      );
      return;
    }

    let inserted = 0;
    let skipped = 0;
    for (const event of events) {
      if (!event.id || !event.userId || !event.type) {
        skipped += 1;
        continue;
      }
      const user = await this.findUserByKeycloakSubject(event.userId);
      if (!user) {
        skipped += 1;
        continue;
      }
      try {
        await this.auditLogs.createByActor(
          systemActor(),
          `KEYCLOAK_${event.type}`,
          'user',
          user.id,
          undefined,
          { clientId: event.clientId ?? null, details: event.details ?? null },
          event.ipAddress,
          undefined,
          undefined,
          event.id,
        );
        inserted += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.toLowerCase().includes('duplicate')) throw error;
        skipped += 1;
      }
    }

    if (inserted > 0 || skipped > 0) {
      this.logger.log(`Événements Keycloak synchronisés : ${inserted} insérés, ${skipped} ignorés/doublons.`);
    }
  }

  private async findUserByKeycloakSubject(subject: string) {
    const [user] = await this.drizzle.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.keycloakSubjectId, subject))
      .limit(1);
    return user;
  }
}
