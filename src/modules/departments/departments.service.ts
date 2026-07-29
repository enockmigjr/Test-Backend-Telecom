/**
 * ============================================================================
 * FICHIER : src/modules/departments/departments.service.ts
 * RÔLE : Service métier de gestion de la structure et du découpage par département.
 * EXPLICATION :
 * Ce service gère les opérations sur les départements de l'entreprise télécom dans PostgreSQL :
 * 1. `findAll` & `findOne` : Filtrent les départements actifs (`deletedAt IS NULL`) par ordre alphabétique.
 * 2. `create` & `update` : Assurent l'unicité du nom de département.
 * 3. `remove` : Effectue une suppression logique (Soft Delete) en marquant `deletedAt = NOW()`. Interdit la suppression si au moins un employé (`users`) ou un ticket d'incident (`tickets`) est rattaché à ce département.
 * ============================================================================
 */

import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { eq, sql, and, isNull } from 'drizzle-orm';
import { generateUuid } from '../../common/helpers/uuidv7.helper';

import { DrizzleProvider } from '../../database/drizzle.provider';
import { departments, users, tickets } from '../../database/schemas';

/**
 * Service orchestrant la persistance et les règles de validation des départements.
 */
@Injectable()
export class DepartmentsService {
  private readonly logger = new Logger(DepartmentsService.name);

  constructor(private readonly drizzle: DrizzleProvider) {}

  /**
   * Extrait la liste de tous les départements actifs triés par nom.
   */
  async findAll() {
    return this.drizzle.db.select().from(departments).where(isNull(departments.deletedAt)).orderBy(departments.name);
  }

  /**
   * Recherche un département actif par son identifiant UUIDv7.
   *
   * @param id UUID du département.
   * @throws NotFoundException si le département n'existe pas ou est supprimé.
   */
  async findOne(id: string) {
    const [department] = await this.drizzle.db
      .select()
      .from(departments)
      .where(and(eq(departments.id, id), isNull(departments.deletedAt)))
      .limit(1);

    if (!department) {
      throw new NotFoundException('Département non trouvé.');
    }

    return department;
  }

  /**
   * Enregistre un nouveau département.
   *
   * @param dto Nom et description optionnelle du département.
   * @throws ConflictException si le nom est déjà utilisé.
   */
  async create(dto: { name: string; description?: string }) {
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

  /**
   * Met à jour le nom ou la description d'un département.
   *
   * @param id UUID du département.
   * @param dto Modifications demandées.
   */
  async update(id: string, dto: { name?: string; description?: string }) {
    await this.findOne(id); // Vérifie l'existence du département

    const updateData: Record<string, unknown> = {};
    if (dto.name) updateData['name'] = dto.name;
    if (dto.description !== undefined) updateData['description'] = dto.description;

    await this.drizzle.db.update(departments).set(updateData).where(eq(departments.id, id));

    const [updated] = await this.drizzle.db.select().from(departments).where(eq(departments.id, id)).limit(1);

    return { message: 'Département mis à jour avec succès.', data: updated };
  }

  /**
   * Applique une suppression logique (Soft Delete) sur un département libre de toute association.
   *
   * @param id UUID du département.
   * @throws ConflictException si des utilisateurs ou des tickets y sont encore rattachés.
   */
  async remove(id: string) {
    await this.findOne(id);

    // 1. Vérifier si des utilisateurs appartiennent à ce département
    const [userCount] = await this.drizzle.db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.departmentId, id));

    if (userCount && userCount.count > 0) {
      throw new ConflictException('Impossible de supprimer : des utilisateurs sont liés à ce département.');
    }

    // 2. Vérifier si des tickets sont rattachés à ce département
    const [ticketCount] = await this.drizzle.db
      .select({ count: sql<number>`count(*)` })
      .from(tickets)
      .where(eq(tickets.departmentId, id));

    if (ticketCount && ticketCount.count > 0) {
      throw new ConflictException('Impossible de supprimer : des tickets sont liés à ce département.');
    }

    // Soft delete — horodatage de la suppression logique
    await this.drizzle.db.update(departments).set({ deletedAt: new Date() }).where(eq(departments.id, id));
    this.logger.log(`Département désactivé (soft delete): ${id}`);
  }
}
