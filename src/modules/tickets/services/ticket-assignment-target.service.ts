/**
 * ============================================================================
 * FICHIER : src/modules/tickets/services/ticket-assignment-target.service.ts
 * RÔLE : Service de validation de l'éligibilité d'un agent cible pour l'assignation d'un ticket.
 * EXPLICATION :
 * Ce service garantit qu'un ticket ne peut être assigné qu'à un utilisateur valide :
 * 1. `assertEligible` : Vérifie que l'agent est actif (`isActive = true`), non supprimé (`deletedAt IS NULL`), et rattaché au département destinataire (`departmentId`).
 * 2. Lève une exception `BadRequestException` si l'agent ne remplit pas ces critères.
 * ============================================================================
 */

import { BadRequestException, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { users } from '../../../database/schemas';

/**
 * Service de contrôle de validité des destinataires d'assignation de tickets.
 */
@Injectable()
export class TicketAssignmentTargetService {
  constructor(private readonly drizzle: DrizzleProvider) {}

  /**
   * Vérifie que l'agent ciblé est actif, disponible (ni pause, ni absence),
   * et membre du département destinataire.
   *
   * @param userId UUID de l'agent destinataire.
   * @param departmentId UUID du département assigné au ticket.
   * @throws BadRequestException si l'agent est inactif ou n'appartient pas au département.
   */
  async assertEligible(userId: string, departmentId: string): Promise<void> {
    const [target] = await this.drizzle.db
      .select({ id: users.id, isAvailable: users.isAvailable, absenceEndsAt: users.absenceEndsAt })
      .from(users)
      .where(
        and(
          eq(users.id, userId),
          eq(users.departmentId, departmentId),
          eq(users.isActive, true),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);

    if (!target) {
      throw new BadRequestException("L'utilisateur cible doit être actif et appartenir au département assigné.");
    }

    if (!target.isAvailable) {
      throw new BadRequestException("L'utilisateur cible est en pause ou indisponible : assignation refusée.");
    }

    if (target.absenceEndsAt && target.absenceEndsAt > new Date()) {
      throw new BadRequestException(
        `L'utilisateur cible est en absence jusqu'au ${target.absenceEndsAt.toISOString()} : assignation refusée.`,
      );
    }
  }
}
