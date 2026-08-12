/**
 * ============================================================================
 * FICHIER : src/modules/dashboard/public-support-stats.service.ts
 * ROLE : Statistiques agrégées du support public (conversations, demandeurs,
 *        messages, tickets publics, délai de première réponse).
 * EXPLICATION :
 * Ce service alimente le bloc « Support public » du tableau de bord d'administration.
 * Les agrégations sont calculées en temps réel sur support_conversations,
 * support_messages, external_requesters et tickets (sourceChannel != INTERNAL).
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';
import { and, count, isNull, sql } from 'drizzle-orm';
import { DrizzleProvider } from '../../database/drizzle.provider';
import {
  externalRequesters,
  supportConversations,
  supportMessages,
  ticketSatisfaction,
  tickets,
} from '../../database/schemas';

/**
 * Service d'agrégation des indicateurs du support public.
 */
@Injectable()
export class PublicSupportStatsService {
  constructor(private readonly drizzle: DrizzleProvider) {}

  /** Calcule les indicateurs globaux du support public. */
  async overview() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const publicTicketWhere = and(isNull(tickets.deletedAt), sql`${tickets.supportIntegrationId} IS NOT NULL`);

    const [
      [conversationTotals],
      [requesterTotals],
      [messageTotals],
      [ticketTotals],
      [responseStats],
      conversationChannels,
      conversationStatuses,
      ticketChannels,
      recentRequesters,
      [satisfactionStats],
    ] = await Promise.all([
      this.drizzle.db
        .select({
          total: count(),
          open: sql<number>`COUNT(*) FILTER (WHERE ${supportConversations.status} NOT IN ('CLOSED','ABANDONED'))`,
          today: sql<number>`COUNT(*) FILTER (WHERE ${supportConversations.createdAt} >= ${todayStart.toISOString()})`,
        })
        .from(supportConversations),
      this.drizzle.db
        .select({
          total: count(),
          active: sql<number>`COUNT(*) FILTER (WHERE ${externalRequesters.lastSeenAt} >= ${thirtyDaysAgo.toISOString()})`,
        })
        .from(externalRequesters),
      this.drizzle.db
        .select({
          total: count(),
          outbound: sql<number>`COUNT(*) FILTER (WHERE ${supportMessages.direction} = 'OUTBOUND')`,
        })
        .from(supportMessages),
      this.drizzle.db
        .select({
          total: count(),
          open: sql<number>`COUNT(*) FILTER (WHERE ${tickets.status} NOT IN ('RESOLVED','CLOSED','CANCELLED'))`,
        })
        .from(tickets)
        .where(publicTicketWhere),
      this.drizzle.db
        .select({
          avgMinutes: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (${tickets.firstResponseAt} - ${tickets.createdAt})) / 60), 0)`,
        })
        .from(tickets)
        .where(and(publicTicketWhere, sql`${tickets.firstResponseAt} IS NOT NULL`)),
      this.drizzle.db
        .select({ channel: supportConversations.sourceChannel, count: count() })
        .from(supportConversations)
        .groupBy(supportConversations.sourceChannel)
        .orderBy(supportConversations.sourceChannel),
      this.drizzle.db
        .select({ status: supportConversations.status, count: count() })
        .from(supportConversations)
        .groupBy(supportConversations.status)
        .orderBy(supportConversations.status),
      this.drizzle.db
        .select({ channel: tickets.sourceChannel, count: count() })
        .from(tickets)
        .where(publicTicketWhere)
        .groupBy(tickets.sourceChannel)
        .orderBy(tickets.sourceChannel),
      this.drizzle.db
        .select({
          id: externalRequesters.id,
          displayName: externalRequesters.displayName,
          lastSeenAt: externalRequesters.lastSeenAt,
          createdAt: externalRequesters.createdAt,
        })
        .from(externalRequesters)
        .orderBy(sql`${externalRequesters.lastSeenAt} DESC NULLS LAST`)
        .limit(5),
      this.drizzle.db
        .select({
          total: count(),
          submitted: sql<number>`COUNT(*) FILTER (WHERE ${ticketSatisfaction.consumedAt} IS NOT NULL)`,
          avgNote: sql<number>`COALESCE(AVG(${ticketSatisfaction.note}), 0)`,
        })
        .from(ticketSatisfaction),
    ]);

    const channels = new Map<string, { conversations: number; tickets: number }>();
    for (const row of conversationChannels) {
      channels.set(row.channel, { conversations: Number(row.count), tickets: 0 });
    }
    for (const row of ticketChannels) {
      const existing = channels.get(row.channel) ?? { conversations: 0, tickets: 0 };
      existing.tickets = Number(row.count);
      channels.set(row.channel, existing);
    }

    return {
      generatedAt: now.toISOString(),
      summary: {
        totalConversations: Number(conversationTotals?.total ?? 0),
        openConversations: Number(conversationTotals?.open ?? 0),
        conversationsToday: Number(conversationTotals?.today ?? 0),
        totalRequesters: Number(requesterTotals?.total ?? 0),
        activeRequesters: Number(requesterTotals?.active ?? 0),
        totalMessages: Number(messageTotals?.total ?? 0),
        publicRepliesSent: Number(messageTotals?.outbound ?? 0),
        publicTickets: Number(ticketTotals?.total ?? 0),
        openPublicTickets: Number(ticketTotals?.open ?? 0),
        avgFirstResponseMinutes: Math.round(Number(responseStats?.avgMinutes || 0)),
        satisfaction: {
          invited: Number(satisfactionStats?.total ?? 0),
          submitted: Number(satisfactionStats?.submitted ?? 0),
          avgNote:
            Number(satisfactionStats?.total ?? 0) > 0 ? Number(Number(satisfactionStats?.avgNote ?? 0).toFixed(2)) : 0,
        },
      },
      byChannel: Array.from(channels, ([channel, value]) => ({ channel, ...value })),
      byStatus: conversationStatuses.map((row) => ({
        status: row.status,
        count: Number(row.count),
      })),
      recentRequesters: recentRequesters.map((requester) => ({
        id: requester.id,
        displayName: requester.displayName ?? 'Demandeur anonyme',
        lastSeenAt: requester.lastSeenAt ? requester.lastSeenAt.toISOString() : null,
        createdAt: requester.createdAt.toISOString(),
      })),
    };
  }
}
