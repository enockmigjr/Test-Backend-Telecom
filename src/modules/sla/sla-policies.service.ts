import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { slaPolicies, categories } from '../../database/schemas';

@Injectable()
export class SlaPoliciesService {
  private readonly logger = new Logger(SlaPoliciesService.name);

  constructor(private readonly drizzle: DrizzleProvider) {}

  async findAll() {
    return this.drizzle.db
      .select({
        id: slaPolicies.id,
        categoryId: slaPolicies.categoryId,
        categoryName: categories.name,
        priority: slaPolicies.priority,
        firstResponseMinutes: slaPolicies.firstResponseMinutes,
        resolutionMinutes: slaPolicies.resolutionMinutes,
        createdAt: slaPolicies.createdAt,
        updatedAt: slaPolicies.updatedAt,
      })
      .from(slaPolicies)
      .innerJoin(categories, eq(slaPolicies.categoryId, categories.id))
      .orderBy(categories.name, slaPolicies.priority);
  }

  async findOne(id: string) {
    const [policy] = await this.drizzle.db
      .select({
        id: slaPolicies.id,
        categoryId: slaPolicies.categoryId,
        categoryName: categories.name,
        priority: slaPolicies.priority,
        firstResponseMinutes: slaPolicies.firstResponseMinutes,
        resolutionMinutes: slaPolicies.resolutionMinutes,
        createdAt: slaPolicies.createdAt,
        updatedAt: slaPolicies.updatedAt,
      })
      .from(slaPolicies)
      .innerJoin(categories, eq(slaPolicies.categoryId, categories.id))
      .where(eq(slaPolicies.id, id))
      .limit(1);

    if (!policy) throw new NotFoundException('Politique SLA non trouvée.');
    return policy;
  }

  async create(dto: { categoryId: string; priority: string; firstResponseMinutes: number; resolutionMinutes: number }) {
    const [existing] = await this.drizzle.db
      .select()
      .from(slaPolicies)
      .where(
        and(
          eq(slaPolicies.categoryId, dto.categoryId),
          eq(slaPolicies.priority, dto.priority as typeof slaPolicies.$inferSelect.priority),
        ),
      )
      .limit(1);

    if (existing)
      throw new ConflictException('Une politique SLA existe déjà pour cette combinaison catégorie/priorité.');

    const id = generateUuid();
    await this.drizzle.db.insert(slaPolicies).values({
      id,
      categoryId: dto.categoryId,
      priority: dto.priority as typeof slaPolicies.$inferSelect.priority,
      firstResponseMinutes: dto.firstResponseMinutes,
      resolutionMinutes: dto.resolutionMinutes,
    });

    const created = await this.findOne(id);
    return { message: 'Politique SLA créée.', data: created };
  }

  async update(id: string, dto: { firstResponseMinutes?: number; resolutionMinutes?: number }) {
    await this.findOne(id);
    const data: Record<string, unknown> = {};
    if (dto.firstResponseMinutes !== undefined) data['firstResponseMinutes'] = dto.firstResponseMinutes;
    if (dto.resolutionMinutes !== undefined) data['resolutionMinutes'] = dto.resolutionMinutes;
    await this.drizzle.db.update(slaPolicies).set(data).where(eq(slaPolicies.id, id));
    const updated = await this.findOne(id);
    return { message: 'Politique SLA mise à jour.', data: updated };
  }

  /**
   * Trouve la politique SLA pour une catégorie et priorité données.
   */
  async findByCategoryAndPriority(categoryId: string, priority: string) {
    const [policy] = await this.drizzle.db
      .select()
      .from(slaPolicies)
      .where(
        and(
          eq(slaPolicies.categoryId, categoryId),
          eq(slaPolicies.priority, priority as typeof slaPolicies.$inferSelect.priority),
        ),
      )
      .limit(1);
    return policy || null;
  }
}
