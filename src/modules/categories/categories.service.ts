import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { eq, sql, and } from 'drizzle-orm';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { categories, tickets, slaPolicies } from '../../database/schemas';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private readonly drizzle: DrizzleProvider) {}

  async findAll() {
    return this.drizzle.db.select().from(categories).orderBy(categories.name);
  }

  async findOne(id: string) {
    const [category] = await this.drizzle.db.select().from(categories).where(eq(categories.id, id)).limit(1);

    if (!category) {
      throw new NotFoundException('Catégorie non trouvée.');
    }

    return category;
  }

  async create(dto: CreateCategoryDto) {
    const [existing] = await this.drizzle.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.name, dto.name))
      .limit(1);

    if (existing) {
      throw new ConflictException('Une catégorie avec ce nom existe déjà.');
    }

    const id = generateUuid();
    await this.drizzle.db.insert(categories).values({
      id,
      name: dto.name,
      description: dto.description || null,
    });

    this.logger.log(`Catégorie créée: ${dto.name} (${id})`);

    const [created] = await this.drizzle.db.select().from(categories).where(eq(categories.id, id)).limit(1);
    return { message: 'Catégorie créée avec succès.', data: created };
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findOne(id); // Vérifie l'existence

    if (dto.name) {
      const [existing] = await this.drizzle.db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.name, dto.name), sql`${categories.id} != ${id}`))
        .limit(1);

      if (existing) {
        throw new ConflictException('Une catégorie avec ce nom existe déjà.');
      }
    }

    const updateData: Record<string, unknown> = {};
    if (dto.name) updateData['name'] = dto.name;
    if (dto.description !== undefined) updateData['description'] = dto.description;

    await this.drizzle.db.update(categories).set(updateData).where(eq(categories.id, id));

    const [updated] = await this.drizzle.db.select().from(categories).where(eq(categories.id, id)).limit(1);
    return { message: 'Catégorie mise à jour avec succès.', data: updated };
  }

  async remove(id: string) {
    await this.findOne(id);

    // Vérifier si des tickets sont liés
    const [ticketCount] = await this.drizzle.db
      .select({ count: sql<number>`count(*)` })
      .from(tickets)
      .where(eq(tickets.categoryId, id));

    if (ticketCount && ticketCount.count > 0) {
      throw new ConflictException('Impossible de supprimer : des tickets sont liés à cette catégorie.');
    }

    // Vérifier si des politiques SLA sont liées
    const [slaCount] = await this.drizzle.db
      .select({ count: sql<number>`count(*)` })
      .from(slaPolicies)
      .where(eq(slaPolicies.categoryId, id));

    if (slaCount && slaCount.count > 0) {
      throw new ConflictException('Impossible de supprimer : des politiques SLA sont liées à cette catégorie.');
    }

    await this.drizzle.db.delete(categories).where(eq(categories.id, id));
    this.logger.log(`Catégorie supprimée: ${id}`);
    return { message: 'Catégorie supprimée avec succès.' };
  }
}
