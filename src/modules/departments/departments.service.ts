import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { generateUuid } from '../../common/helpers/uuidv7.helper';

import { DrizzleProvider } from '../../database/drizzle.provider';
import { departments, users, tickets } from '../../database/schemas';

@Injectable()
export class DepartmentsService {
  private readonly logger = new Logger(DepartmentsService.name);

  constructor(private readonly drizzle: DrizzleProvider) {}

  async findAll() {
    return this.drizzle.db.select().from(departments).orderBy(departments.name);
  }

  async findOne(id: string) {
    const [department] = await this.drizzle.db.select().from(departments).where(eq(departments.id, id)).limit(1);

    if (!department) {
      throw new NotFoundException('Département non trouvé.');
    }

    return department;
  }

  async create(dto: { name: string; description?: string }) {
    // Vérifier l'unicité du nom
    const [existing] = await this.drizzle.db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.name, dto.name))
      .limit(1);

    if (existing) {
      throw new ConflictException('Un département avec ce nom existe déjà.');
    }

    const id = generateUuid();
    await this.drizzle.db.insert(departments).values({
      id,
      name: dto.name,
      description: dto.description || null,
    });

    this.logger.log(`Département créé: ${dto.name} (${id})`);

    const [created] = await this.drizzle.db.select().from(departments).where(eq(departments.id, id)).limit(1);

    return { message: 'Département créé avec succès.', data: created };
  }

  async update(id: string, dto: { name?: string; description?: string }) {
    await this.findOne(id); // Vérifie l'existence

    const updateData: Record<string, unknown> = {};
    if (dto.name) updateData['name'] = dto.name;
    if (dto.description !== undefined) updateData['description'] = dto.description;

    await this.drizzle.db.update(departments).set(updateData).where(eq(departments.id, id));

    const [updated] = await this.drizzle.db.select().from(departments).where(eq(departments.id, id)).limit(1);

    return { message: 'Département mis à jour avec succès.', data: updated };
  }

  async remove(id: string) {
    await this.findOne(id);

    // Vérifier si des utilisateurs sont liés
    const [userCount] = await this.drizzle.db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.departmentId, id));

    if (userCount && userCount.count > 0) {
      throw new ConflictException('Impossible de supprimer : des utilisateurs sont liés à ce département.');
    }

    // Vérifier si des tickets sont liés
    const [ticketCount] = await this.drizzle.db
      .select({ count: sql<number>`count(*)` })
      .from(tickets)
      .where(eq(tickets.departmentId, id));

    if (ticketCount && ticketCount.count > 0) {
      throw new ConflictException('Impossible de supprimer : des tickets sont liés à ce département.');
    }

    // Soft delete — aucune suppression physique
    await this.drizzle.db.update(departments).set({ deletedAt: new Date() }).where(eq(departments.id, id));
    this.logger.log(`Département désactivé (soft delete): ${id}`);
  }
}
