import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger, Inject } from '@nestjs/common';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { Queue } from 'bullmq';

import { DrizzleProvider } from '../../database/drizzle.provider';
import { users, departments, tickets } from '../../database/schemas';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginationHelper } from '../../common/helpers/pagination.helper';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly drizzle: DrizzleProvider,
    @Inject('BullMQ_Queues') private readonly queues: { email: Queue; notification: Queue; [key: string]: Queue },
  ) {}

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
        departmentName: departments.name,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .where(where)
      .orderBy(order === 'asc' ? users.createdAt : sql`${users.createdAt} desc`)
      .limit(limit)
      .offset(offset);

    return PaginationHelper.paginate(data, total?.count || 0, page, limit);
  }

  /**
   * Profil basique d'un utilisateur — inclut le département.
   */
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
        department: {
          id: departments.id,
          name: departments.name,
          description: departments.description,
        },
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

  /**
   * Profil détaillé d'un utilisateur — inclut département + statistiques tickets.
   * Utilisé par GET /users/:id?detail=full
   */
  async findOneDetailed(id: string) {
    const user = await this.findOne(id);

    // Statistiques des tickets associés à cet utilisateur
    const [ticketStats] = await this.drizzle.db
      .select({
        totalCreated: sql<number>`count(*) filter (where ${tickets.createdBy} = ${id})`,
        totalAssigned: sql<number>`count(*) filter (where ${tickets.assignedTo} = ${id})`,
        openTickets: sql<number>`count(*) filter (where ${tickets.assignedTo} = ${id} and ${tickets.status} not in ('RESOLVED','CLOSED','CANCELLED'))`,
        resolvedTickets: sql<number>`count(*) filter (where ${tickets.assignedTo} = ${id} and ${tickets.status} = 'RESOLVED')`,
        slaBreachedCount: sql<number>`count(*) filter (where ${tickets.assignedTo} = ${id} and ${tickets.slaBreached} = true)`,
      })
      .from(tickets)
      .where(isNull(tickets.deletedAt));

    // 5 derniers tickets assignés
    const recentTickets = await this.drizzle.db
      .select({
        id: tickets.id,
        ticketNumber: tickets.ticketNumber,
        title: tickets.title,
        status: tickets.status,
        priority: tickets.priority,
        createdAt: tickets.createdAt,
        slaBreached: tickets.slaBreached,
      })
      .from(tickets)
      .where(and(eq(tickets.assignedTo, id), isNull(tickets.deletedAt)))
      .orderBy(sql`${tickets.createdAt} desc`)
      .limit(5);

    return {
      ...user,
      ticketStats: {
        totalCreated: Number(ticketStats?.totalCreated ?? 0),
        totalAssigned: Number(ticketStats?.totalAssigned ?? 0),
        openTickets: Number(ticketStats?.openTickets ?? 0),
        resolvedTickets: Number(ticketStats?.resolvedTickets ?? 0),
        slaBreachedCount: Number(ticketStats?.slaBreachedCount ?? 0),
      },
      recentTickets,
    };
  }

  async create(dto: { email: string; firstName: string; lastName: string; role: string; departmentId: string }) {
    const [existing] = await this.drizzle.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, dto.email.toLowerCase().trim()), isNull(users.deletedAt)))
      .limit(1);

    if (existing) {
      throw new ConflictException('Un utilisateur avec cet email existe déjà.');
    }

    const [dept] = await this.drizzle.db
      .select({ id: departments.id, name: departments.name })
      .from(departments)
      .where(eq(departments.id, dto.departmentId))
      .limit(1);

    if (!dept) {
      throw new BadRequestException('Département non trouvé.');
    }

    const tempPassword = randomBytes(12).toString('hex');
    const passwordHash = await argon2.hash(tempPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const id = generateUuid();
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

    this.logger.log(`Utilisateur créé: ${dto.email} (${id}), département: ${dept.name}`);

    // Envoyer l'email de bienvenue avec le mot de passe temporaire (asynchrone, non-bloquant)
    this.sendWelcomeEmail(dto.email, dto.firstName, dto.lastName, tempPassword).catch((err) => {
      this.logger.warn(`Échec envoi email de bienvenue à ${dto.email}: ${(err as Error).message}`);
    });

    return {
      message: 'Utilisateur créé avec succès.',
      data: {
        id,
        email: dto.email.toLowerCase().trim(),
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
        departmentId: dto.departmentId,
        departmentName: dept.name,
        mustChangePassword: true,
        tempPassword,
      },
    };
  }

  async update(id: string, dto: { firstName?: string; lastName?: string; role?: string; departmentId?: string }) {
    await this.findOne(id);

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

  /**
   * Envoie l'email de bienvenue avec le mot de passe temporaire
   * via la file d'attente BullMQ (non-bloquant).
   */
  private async sendWelcomeEmail(to: string, firstName: string, lastName: string, tempPassword: string): Promise<void> {
    const loginUrl = process.env['LOGIN_URL'] || 'http://localhost:3000/login';
    try {
      await this.queues.email.add('send-email', {
        to,
        subject: '👤 Votre compte Telecom Ticket Management',
        template: 'accountCreated',
        data: {
          firstName,
          lastName,
          email: to,
          tempPassword,
          loginUrl,
        },
      });
      this.logger.log(`Email de bienvenue enqueued pour ${to}`);
    } catch (err) {
      // Redis/BullMQ indisponible — non-bloquant, le mot de passe est aussi
      // retourné dans la réponse HTTP (usage unique)
      this.logger.warn(`Impossible d'enqueuer l'email de bienvenue pour ${to}: ${(err as Error).message}`);
    }
  }
}
