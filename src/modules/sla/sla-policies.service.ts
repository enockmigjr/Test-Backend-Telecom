/**
 * ============================================================================
 * FICHIER : src/modules/sla/sla-policies.service.ts
 * RÔLE : Service de persistance et de consultation des politiques contractuelles SLA.
 * EXPLICATION :
 * Ce service administre la matrice de règles SLA (combinaisons catégorie + priorité) :
 * 1. `findAll` & `findOne` : Extrait la liste des politiques avec jointure sur les catégories (`categories.name`).
 * 2. `create` : Enregistre une nouvelle politique en vérifiant l'unicité du couple (catégorie, priorité) via `ConflictException`.
 * 3. `findByCategoryAndPriority` : Méthode clé appelée lors de la création d'un ticket pour extraire les minutes de réponse (`firstResponseMinutes`) et de résolution (`resolutionMinutes`).
 * ============================================================================
 */

import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { slaPolicies, categories } from '../../database/schemas';

/**
 * Service orchestrant les politiques de contrats de niveau de service SLA dans PostgreSQL.
 */
@Injectable()
export class SlaPoliciesService {
  private readonly logger = new Logger(SlaPoliciesService.name);

  constructor(private readonly drizzle: DrizzleProvider) {}

  /**
   * Extrait la liste complète des politiques SLA avec les noms de catégories associés.
   */
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

  /**
   * Recherche une politique SLA par son identifiant unique.
   *
   * @param id UUID de la politique SLA.
   * @throws NotFoundException si la politique est introuvable.
   */
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

  /**
   * Crée une nouvelle règle SLA pour un couple catégorie/priorité.
   *
   * @param dto Paramètres de la politique SLA.
   * @throws ConflictException si une politique existe déjà pour ce couple.
   */
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

  /**
   * Met à jour les minutes cibles de première réponse ou de résolution d'une politique.
   *
   * @param id UUID de la politique.
   * @param dto Nouveaux délais en minutes.
   */
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
   * Recherche la politique SLA exacte correspondant à la catégorie et la priorité d'un nouveau ticket.
   *
   * @param categoryId Identifiant de la catégorie.
   * @param priority Niveau de priorité (LOW, MEDIUM, HIGH, CRITICAL).
   * @returns La politique SLA trouvée ou null.
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
