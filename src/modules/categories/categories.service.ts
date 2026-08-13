/**
 * ============================================================================
 * FICHIER : src/modules/categories/categories.service.ts
 * RÔLE : Service de gestion métier de la typologie des incidents et des cibles d'auto-assignation.
 * EXPLICATION :
 * Ce service gère les catégories de tickets dans la base de données PostgreSQL :
 * 1. `create` & `update` : Maintiennent le nom unique des catégories et associent un rôle métier (`targetRole`) guidant la distribution automatique des tickets vers les agents spécialisés (ex: NOC_ENGINEER, BILLING_SPECIALIST).
 * 2. `remove` : Protège l'intégrité référentielle en bloquant la suppression si au moins un ticket (`tickets`) ou une politique de contrat de service (`slaPolicies`) est liée à cette catégorie.
 * ============================================================================
 */

import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { eq, sql, and } from 'drizzle-orm';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { categories, tickets, slaPolicies } from '../../database/schemas';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/create-category.dto';

/**
 * Service orchestrant les opérations CRUD sur le référentiel des catégories d'incidents.
 */
@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private readonly drizzle: DrizzleProvider) {}

  /**
   * Retourne l'ensemble des catégories triées par ordre alphabétique.
   */
  async findAll() {
    const rows = await this.drizzle.db.select().from(categories).orderBy(categories.name);
    return rows.map((row) => ({ ...row, targetRoles: row.targetRoles ?? [] }));
  }

  /**
   * Extrait une catégorie par son UUIDv7.
   *
   * @param id Identifiant UUIDv7 de la catégorie.
   * @throws NotFoundException si la catégorie n'existe pas.
   */
  async findOne(id: string) {
    const [category] = await this.drizzle.db.select().from(categories).where(eq(categories.id, id)).limit(1);

    if (!category) {
      throw new NotFoundException('Catégorie non trouvée.');
    }

    return { ...category, targetRoles: category.targetRoles ?? [] };
  }

  /**
   * Enregistre une nouvelle catégorie de ticket.
   *
   * @param dto Objet contenant le nom, la description et le rôle cible pour l'auto-assignation.
   * @throws ConflictException si une catégorie avec le même nom existe déjà.
   */
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
      targetRole: dto.targetRole || null,
      targetRoles: this.resolveTargetRoles(dto),
    });

    this.logger.log(`Catégorie créée: ${dto.name} (${id})`);

    const [created] = await this.drizzle.db.select().from(categories).where(eq(categories.id, id)).limit(1);
    return { message: 'Catégorie créée avec succès.', data: { ...created, targetRoles: created.targetRoles ?? [] } };
  }

  /**
   * Met à jour les propriétés d'une catégorie.
   *
   * @param id UUID de la catégorie à modifier.
   * @param dto Champs à mettre à jour.
   * @throws ConflictException si le nouveau nom est déjà attribué à une autre catégorie.
   */
  async update(id: string, dto: UpdateCategoryDto) {
    await this.findOne(id); // Vérifie l'existence de la catégorie

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
    if (dto.targetRole !== undefined) updateData['targetRole'] = dto.targetRole;
    if (dto.targetRoles !== undefined) {
      updateData['targetRoles'] = dto.targetRoles.length > 0 ? dto.targetRoles : [];
      if (dto.targetRole === undefined) updateData['targetRole'] = dto.targetRoles[0] ?? null;
    }

    await this.drizzle.db.update(categories).set(updateData).where(eq(categories.id, id));

    const [updated] = await this.drizzle.db.select().from(categories).where(eq(categories.id, id)).limit(1);
    return {
      message: 'Catégorie mise à jour avec succès.',
      data: { ...updated, targetRoles: updated.targetRoles ?? [] },
    };
  }

  /**
   * Supprime une catégorie si elle n'est rattachée à aucun ticket ni à aucune politique SLA.
   *
   * @param id UUID de la catégorie.
   * @throws ConflictException si des tickets ou règles SLA y sont rattachés.
   */
  async remove(id: string) {
    await this.findOne(id);

    // 1. Vérifier si des tickets d'incidents sont rattachés à cette catégorie
    const [ticketCount] = await this.drizzle.db
      .select({ count: sql<number>`count(*)` })
      .from(tickets)
      .where(eq(tickets.categoryId, id));

    if (ticketCount && ticketCount.count > 0) {
      throw new ConflictException('Impossible de supprimer : des tickets sont liés à cette catégorie.');
    }

    // 2. Vérifier si des règles SLA font référence à cette catégorie
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

  /**
   * Résout les rôles cibles : priorité au tableau `targetRoles`, repli sur `targetRole`.
   */
  private resolveTargetRoles(dto: CreateCategoryDto | UpdateCategoryDto): string[] | null {
    if (dto.targetRoles && dto.targetRoles.length > 0) return [...dto.targetRoles];
    return dto.targetRole ? [dto.targetRole] : [];
  }
}
