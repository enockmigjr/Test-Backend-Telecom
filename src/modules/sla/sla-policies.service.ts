import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { slaPolicies } from '../../database/schemas';

@Injectable()
export class SlaPoliciesService {
  private readonly logger = new Logger(SlaPoliciesService.name);

  constructor(private readonly drizzle: DrizzleProvider) {}

  async findAll() {
    return this.drizzle.db.select().from(slaPolicies).orderBy(slaPolicies.category, slaPolicies.priority);
  }

  async findOne(id: string) {
    const [policy] = await this.drizzle.db.select().from(slaPolicies).where(eq(slaPolicies.id, id)).limit(1);
    if (!policy) throw new NotFoundException('Politique SLA non trouvée.');
    return policy;
  }

  async create(dto: { category: string; priority: string; firstResponseMinutes: number; resolutionMinutes: number }) {
    const [existing] = await this.drizzle.db
      .select()
      .from(slaPolicies)
      .where(
        and(
          eq(slaPolicies.category, dto.category as typeof slaPolicies.$inferSelect.category),
          eq(slaPolicies.priority, dto.priority as typeof slaPolicies.$inferSelect.priority),
        ),
      )
      .limit(1);

    if (existing)
      throw new ConflictException('Une politique SLA existe déjà pour cette combinaison catégorie/priorité.');

    const id = generateUuid();
    await this.drizzle.db.insert(slaPolicies).values({
      id,
      category: dto.category as typeof slaPolicies.$inferSelect.category,
      priority: dto.priority as typeof slaPolicies.$inferSelect.priority,
      firstResponseMinutes: dto.firstResponseMinutes,
      resolutionMinutes: dto.resolutionMinutes,
    });

    const [created] = await this.drizzle.db.select().from(slaPolicies).where(eq(slaPolicies.id, id)).limit(1);
    return { message: 'Politique SLA créée.', data: created };
  }

  async update(id: string, dto: { firstResponseMinutes?: number; resolutionMinutes?: number }) {
    await this.findOne(id);
    const data: Record<string, unknown> = {};
    if (dto.firstResponseMinutes) data['firstResponseMinutes'] = dto.firstResponseMinutes;
    if (dto.resolutionMinutes) data['resolutionMinutes'] = dto.resolutionMinutes;
    await this.drizzle.db.update(slaPolicies).set(data).where(eq(slaPolicies.id, id));
    const [updated] = await this.drizzle.db.select().from(slaPolicies).where(eq(slaPolicies.id, id)).limit(1);
    return { message: 'Politique SLA mise à jour.', data: updated };
  }

  /**
   * Trouve la politique SLA pour une catégorie et priorité données.
   */
  async findByCategoryAndPriority(category: string, priority: string) {
    const [policy] = await this.drizzle.db
      .select()
      .from(slaPolicies)
      .where(
        and(
          eq(slaPolicies.category, category as typeof slaPolicies.$inferSelect.category),
          eq(slaPolicies.priority, priority as typeof slaPolicies.$inferSelect.priority),
        ),
      )
      .limit(1);
    return policy || null;
  }
}
