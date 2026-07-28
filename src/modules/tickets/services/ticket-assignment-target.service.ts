import { BadRequestException, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { users } from '../../../database/schemas';

@Injectable()
export class TicketAssignmentTargetService {
  constructor(private readonly drizzle: DrizzleProvider) {}

  async assertEligible(userId: string, departmentId: string): Promise<void> {
    const [target] = await this.drizzle.db
      .select({ id: users.id })
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
      throw new BadRequestException("L'utilisateur cible doit etre actif et appartenir au departement assigne.");
    }
  }
}
