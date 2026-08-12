/**
 * ============================================================================
 * FICHIER : src/modules/support-satisfaction/support-satisfaction.service.ts
 * ROLE : Génération et consommation des liens de satisfaction des tickets publics.
 * EXPLICATION :
 * Un jeton opaque est généré à la clôture (ou sur demande admin), stocké haché,
 * expire après 14 jours et ne peut être consommé qu'une seule fois.
 * ============================================================================
 */

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { and, count, eq, isNull, sql } from 'drizzle-orm';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { ticketSatisfaction, tickets } from '../../database/schemas';
import { generateUuid } from '../../common/helpers/uuidv7.helper';

const SATISFACTION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

@Injectable()
export class SupportSatisfactionService {
  constructor(private readonly drizzle: DrizzleProvider) {}

  /** Génère un lien de satisfaction unique pour un ticket. */
  async createForTicket(ticketId: string) {
    const [ticket] = await this.drizzle.db
      .select({ supportIntegrationId: tickets.supportIntegrationId })
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);
    if (!ticket) throw new NotFoundException('Ticket non trouvé.');

    const [existing] = await this.drizzle.db
      .select({ id: ticketSatisfaction.id })
      .from(ticketSatisfaction)
      .where(and(eq(ticketSatisfaction.ticketId, ticketId), isNull(ticketSatisfaction.consumedAt)))
      .limit(1);
    if (existing) {
      throw new ConflictException('Un lien de satisfaction est déjà actif pour ce ticket.');
    }

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SATISFACTION_TTL_MS);
    await this.drizzle.db.insert(ticketSatisfaction).values({
      id: generateUuid(),
      ticketId,
      supportIntegrationId: ticket.supportIntegrationId ?? null,
      tokenHash: hashToken(token),
      expiresAt,
    });
    const origin = process.env['PUBLIC_PORTAL_ORIGIN'] ?? 'http://localhost:3005';
    return { url: `${origin}/satisfaction?t=${token}&id=${ticketId}`, expiresAt: expiresAt.toISOString() };
  }

  /** Consomme le lien : enregistre la note et le commentaire. */
  async submit(ticketId: string, token: string, note: number, comment?: string) {
    if (note < 1 || note > 5) throw new BadRequestException('La note doit être comprise entre 1 et 5.');
    const [row] = await this.drizzle.db
      .select()
      .from(ticketSatisfaction)
      .where(and(eq(ticketSatisfaction.tokenHash, hashToken(token)), eq(ticketSatisfaction.ticketId, ticketId)))
      .limit(1);
    if (!row) throw new NotFoundException('Lien de satisfaction invalide.');
    if (row.consumedAt) throw new ConflictException('La satisfaction a déjà été soumise.');
    if (row.expiresAt.getTime() < Date.now()) throw new BadRequestException('Le lien de satisfaction a expiré.');

    await this.drizzle.db
      .update(ticketSatisfaction)
      .set({ note, comment: comment ?? null, consumedAt: new Date() })
      .where(eq(ticketSatisfaction.id, row.id));
    return { message: 'Merci, votre retour a bien été enregistré.' };
  }

  /** Agrégats de satisfaction pour le dashboard support public. */
  async stats() {
    const [row] = await this.drizzle.db
      .select({
        total: count(),
        submitted: sql<number>`COUNT(*) FILTER (WHERE ${ticketSatisfaction.consumedAt} IS NOT NULL)`,
        avgNote: sql<number>`COALESCE(AVG(${ticketSatisfaction.note}), 0)`,
        note1: sql<number>`COUNT(*) FILTER (WHERE ${ticketSatisfaction.note} = 1)`,
        note2: sql<number>`COUNT(*) FILTER (WHERE ${ticketSatisfaction.note} = 2)`,
        note3: sql<number>`COUNT(*) FILTER (WHERE ${ticketSatisfaction.note} = 3)`,
        note4: sql<number>`COUNT(*) FILTER (WHERE ${ticketSatisfaction.note} = 4)`,
        note5: sql<number>`COUNT(*) FILTER (WHERE ${ticketSatisfaction.note} = 5)`,
      })
      .from(ticketSatisfaction);
    const total = Number(row?.total ?? 0);
    return {
      totalInvited: total,
      submitted: Number(row?.submitted ?? 0),
      avgNote: total > 0 ? Number(Number(row?.avgNote ?? 0).toFixed(2)) : 0,
      responseRate: total > 0 ? Number(((Number(row?.submitted ?? 0) / total) * 100).toFixed(2)) : 0,
      distribution: {
        '1': Number(row?.note1 ?? 0),
        '2': Number(row?.note2 ?? 0),
        '3': Number(row?.note3 ?? 0),
        '4': Number(row?.note4 ?? 0),
        '5': Number(row?.note5 ?? 0),
      },
    };
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
