import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';

import { DrizzleProvider } from '../../database/drizzle.provider';
import { users, departments } from '../../database/schemas';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginationHelper } from '../../common/helpers/pagination.helper';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly drizzle: DrizzleProvider) {}

  async findAll(dto: PaginationDto) {
    const { page = 1, limit = 20, order = 'desc' } = dto;
    const offset = PaginationHelper.getOffset(page, limit);

    const where = isNull(users.deletedAt);

    const [total] = await this.drizzle.db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(where);

    const data = await this.drizzle.db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        isActive: users.isActive,
        departmentId: users.departmentId,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(where)
      .orderBy(order === 'asc' ? users.createdAt : sql`${users.createdAt} desc`)
      .limit(limit)
      .offset(offset);

    return PaginationHelper.paginate(data, total?.count || 0, page, limit);
  }

  async findOne(id: string) {
    const [user] = await this.drizzle.db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        isActive: users.isActive,
        mustChangePassword: users.mustChangePassword,
        departmentId: users.departmentId,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        departmentName: departments.name,
      })
      .from(users)
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé.');
    }

    return user;
  }

  async create(dto: { email: string; firstName: string; lastName: string; role: string; departmentId: string }) {
    // Vérifier l'unicité de l'email
    const [existing] = await this.drizzle.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, dto.email.toLowerCase().trim()), isNull(users.deletedAt)))
      .limit(1);

    if (existing) {
      throw new ConflictException('Un utilisateur avec cet email existe déjà.');
    }

    // Vérifier que le département existe
    const [dept] = await this.drizzle.db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.id, dto.departmentId))
      .limit(1);

    if (!dept) {
      throw new BadRequestException('Département non trouvé.');
    }

    // Générer un mot de passe temporaire
    const tempPassword = randomBytes(12).toString('hex');
    const passwordHash = await argon2.hash(tempPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const id = uuidv4();
    await this.drizzle.db.insert(users).values({
      id,
      email: dto.email.toLowerCase().trim(),
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role as typeof users.$inferSelect.role,
      departmentId: dto.departmentId,
      mustChangePassword: true,
    });

    const [created] = await this.drizzle.db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        departmentId: users.departmentId,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    this.logger.log(`Utilisateur créé: ${dto.email} (${id}), mot de passe temporaire généré`);

    return {
      message: 'Utilisateur créé avec succès.',
      data: {
        ...created,
        tempPassword, // À envoyer par email en production
      },
    };
  }

  async update(id: string, dto: { firstName?: string; lastName?: string; role?: string; departmentId?: string }) {
    await this.findOne(id); // Vérifie l'existence

    const updateData: Record<string, unknown> = {};
    if (dto.firstName) updateData['firstName'] = dto.firstName;
    if (dto.lastName) updateData['lastName'] = dto.lastName;
    if (dto.role) updateData['role'] = dto.role;
    if (dto.departmentId) updateData['departmentId'] = dto.departmentId;

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('Aucune donnée à mettre à jour.');
    }

    await this.drizzle.db.update(users).set(updateData).where(eq(users.id, id));

    const updated = await this.findOne(id);
    this.logger.log(`Utilisateur mis à jour: ${id}`);

    return { message: 'Utilisateur mis à jour avec succès.', data: updated };
  }

  async deactivate(id: string) {
    const user = await this.findOne(id);

    if (!user.isActive) {
      throw new BadRequestException('Cet utilisateur est déjà désactivé.');
    }

    await this.drizzle.db.update(users).set({ isActive: false }).where(eq(users.id, id));

    this.logger.log(`Utilisateur désactivé: ${id}`);
    return { message: 'Utilisateur désactivé avec succès.' };
  }

  async activate(id: string) {
    const user = await this.findOne(id);

    if (user.isActive) {
      throw new BadRequestException('Cet utilisateur est déjà actif.');
    }

    await this.drizzle.db.update(users).set({ isActive: true }).where(eq(users.id, id));

    this.logger.log(`Utilisateur réactivé: ${id}`);
    return { message: 'Utilisateur réactivé avec succès.' };
  }
}
