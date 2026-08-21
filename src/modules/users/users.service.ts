/**
 * ============================================================================
 * FICHIER : src/modules/users/users.service.ts
 * RÔLE : Service de gestion de l'annuaire des comptes utilisateurs et agents.
 * EXPLICATION :
 * Ce service regroupe toutes les opérations sur les comptes utilisateurs et techniciens :
 * 1. Création de compte : profil métier en base + provisionnement du compte SSO
 *    Keycloak (mot de passe temporaire `temporary=true` → changement forcé à la
 *    première connexion, rôle realm synchronisé) + email de bienvenue (BullMQ).
 * 2. Consultation des profils simples (`findOne`) et détaillés (`findOneDetailed` avec métriques de tickets créés, assignés, résolus et SLA franchis).
 * 3. Mise à jour sous contraintes RBAC/ABAC : Les superviseurs sont cantonnés à leur département et ne peuvent pas nommer d'autres superviseurs ou administrateurs.
 * 4. Activation, désactivation et suppression logique (`deletedAt`).
 * ============================================================================
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Inject,
} from '@nestjs/common';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';

import { DrizzleProvider } from '../../database/drizzle.provider';
import { users, departments, tickets } from '../../database/schemas';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { BullMqQueues } from '../../queues/queues.types';
import { CreateUserInput, UpdateUserInput } from './interfaces/user-service.interfaces';
import { KeycloakAdminService } from '../auth/services/keycloak-admin.service';

/**
 * Service gérant le cycle de vie, les autorisations et les statistiques des utilisateurs.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly drizzle: DrizzleProvider,
    @Inject('BullMQ_Queues') private readonly queues: BullMqQueues,
    private readonly keycloakAdmin: KeycloakAdminService,
  ) {}

  /**
   * Récupère la liste paginée des utilisateurs du système (filtrée par département pour les superviseurs).
   *
   * @param dto Paramètres de pagination (page, limit, order).
   * @param currentUser Contexte de l'utilisateur connecté.
   * @returns Liste des utilisateurs et métadonnées de pagination.
   */
  async findAll(dto: PaginationDto, currentUser?: JwtPayload) {
    const { page = 1, limit = 20, order = 'desc' } = dto;
    const offset = PaginationHelper.getOffset(page, limit);

    const conditions = [isNull(users.deletedAt)];
    if (currentUser?.role === 'SUPERVISOR') {
      conditions.push(eq(users.departmentId, currentUser.departmentId));
    }
    const where = and(...conditions);

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
        isAvailable: users.isAvailable,
        absenceEndsAt: users.absenceEndsAt,
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

    return PaginationHelper.paginate(data, Number(total?.count ?? 0), page, limit);
  }

  /**
   * Récupère le profil individuel d'un utilisateur par son identifiant.
   *
   * @param id Identifiant UUIDv7 de l'utilisateur.
   * @returns Profil utilisateur avec les informations relatives à son département.
   * @throws NotFoundException Si l'utilisateur n'existe pas ou a été supprimé.
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
        isAvailable: users.isAvailable,
        absenceEndsAt: users.absenceEndsAt,
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
   * Récupère la fiche détaillée d'un agent avec ses métriques et son historique récent de tickets.
   *
   * @param id Identifiant de l'utilisateur.
   * @returns Profil enrichi avec statistiques de tickets (créés, assignés, ouverts, résolus, dépassements SLA).
   */
  async findOneDetailed(id: string) {
    const user = await this.findOne(id);

    // Statistiques des tickets associés à cet utilisateur
    const [ticketStats] = await this.drizzle.db
      .select({
        totalCreated: sql<number>`count(*) filter (where coalesce(${tickets.openedByUserId}, ${tickets.createdBy}) = ${id})`,
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

  /**
   * Crée un nouvel utilisateur dans le système avec génération d'un mot de passe temporaire.
   *
   * @param dto Données de création (email, nom, prénom, rôle, département).
   * @returns Un message de confirmation avec les détails du compte créé.
   * @throws ConflictException Si l'adresse email est déjà enregistrée.
   * @throws BadRequestException Si le département spécifié n'existe pas.
   */
  async create(dto: CreateUserInput) {
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
      // Keycloak impose le changement du mot de passe temporaire (UPDATE_PASSWORD) ;
      // le flag métier ne bloque plus l'accès applicatif.
      mustChangePassword: false,
    });

    // Provisionne le compte SSO Keycloak : création + mot de passe temporaire
    // (temporary=true force le changement à la première connexion) + rôle realm.
    try {
      const keycloakUserId = await this.keycloakAdmin.createUser({
        username: dto.email.toLowerCase().trim(),
        email: dto.email.toLowerCase().trim(),
        firstName: dto.firstName,
        lastName: dto.lastName,
      });
      await this.keycloakAdmin.resetPassword(keycloakUserId, tempPassword);
      await this.keycloakAdmin.syncRealmRoles(keycloakUserId, [dto.role]);
      await this.keycloakAdmin.ensureAccountRoles(keycloakUserId);
      await this.drizzle.db.update(users).set({ keycloakSubjectId: keycloakUserId }).where(eq(users.id, id));
    } catch (error) {
      this.logger.error(
        `Échec du provisionnement Keycloak pour ${dto.email}`,
        error instanceof Error ? error.stack : String(error),
      );
      await this.drizzle.db.delete(users).where(eq(users.id, id));
      throw new ConflictException(
        'Création du compte SSO impossible (Keycloak indisponible ou config manquante). Réessayez plus tard.',
      );
    }

    this.logger.log(`Utilisateur créé: ${dto.email} (${id}), département: ${dept.name}`);

    // Envoyer l'email de bienvenue avec le mot de passe temporaire (asynchrone, non-bloquant)
    this.sendWelcomeEmail(dto.email, dto.firstName, dto.lastName, tempPassword, dto.role, dept.name).catch((err) => {
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
        mustChangePassword: false,
        tempPassword,
      },
    };
  }

  /**
   * Met à jour les informations d'un utilisateur en appliquant les restrictions RBAC selon le rôle de l'opérateur.
   *
   * @param id Identifiant de l'utilisateur à modifier.
   * @param dto Champs à modifier (nom, prénom, rôle, département).
   * @param currentUser Utilisateur effectuant l'opération.
   * @throws ForbiddenException Si les règles de sécurité/hiérarchie sont enfreintes.
   */
  async update(id: string, dto: UpdateUserInput, currentUser?: JwtPayload) {
    const userToUpdate = await this.findOne(id);

    if (currentUser?.role === 'SUPERVISOR') {
      if (userToUpdate.departmentId !== currentUser.departmentId) {
        throw new ForbiddenException(
          "Vous n'avez pas le droit de modifier un utilisateur en dehors de votre département.",
        );
      }
      if (['ADMINISTRATOR', 'SUPERVISOR'].includes(userToUpdate.role as string)) {
        throw new ForbiddenException('Un superviseur ne peut pas modifier un administrateur ou un superviseur.');
      }
      if (dto.departmentId && dto.departmentId !== currentUser.departmentId) {
        throw new ForbiddenException('Un superviseur ne peut pas déplacer un utilisateur vers un département tiers.');
      }
      if (dto.role && ['ADMINISTRATOR', 'SUPERVISOR'].includes(dto.role)) {
        throw new ForbiddenException(
          "Un superviseur ne peut pas attribuer un rôle d'administrateur ou de superviseur.",
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (dto.firstName !== undefined) updateData['firstName'] = dto.firstName;
    if (dto.lastName !== undefined) updateData['lastName'] = dto.lastName;
    if (dto.role !== undefined) updateData['role'] = dto.role;
    if (dto.departmentId !== undefined) updateData['departmentId'] = dto.departmentId;
    if (dto.isAvailable !== undefined) updateData['isAvailable'] = dto.isAvailable;
    if (dto.absenceEndsAt !== undefined) {
      updateData['absenceEndsAt'] = dto.absenceEndsAt === null ? null : new Date(dto.absenceEndsAt);
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('Aucune donnée à mettre à jour.');
    }

    await this.drizzle.db.update(users).set(updateData).where(eq(users.id, id));

    // Synchronise le rôle du compte SSO (mapping realm Keycloak = rôle métier).
    if (dto.role !== undefined) {
      const subject = await this.findSubject(id);
      if (subject) {
        await this.keycloakAdmin.syncRealmRoles(subject, [dto.role]);
      }
    }

    const updated = await this.findOne(id);
    this.logger.log(`Utilisateur mis à jour: ${id}`);

    return { message: 'Utilisateur mis à jour avec succès.', data: updated };
  }

  /**
   * Désactive un compte utilisateur (interdit les connexions futures sans supprimer le compte).
   *
   * @param id Identifiant de l'utilisateur.
   * @throws BadRequestException Si l'utilisateur est déjà désactivé.
   */
  async deactivate(id: string, currentUser?: JwtPayload) {
    const user = await this.findOne(id);

    if (!user.isActive) {
      throw new BadRequestException('Cet utilisateur est déjà désactivé.');
    }
    if (currentUser && (currentUser as unknown as { sub: string }).sub === id) {
      throw new BadRequestException('Vous ne pouvez pas désactiver votre propre compte.');
    }
    if (user.role === 'ADMINISTRATOR') {
      try {
        const res: unknown = await (this.drizzle.db
          .select({ count: sql<number>`count(*)` })
          .from(users)
          .where(and(eq(users.role, 'ADMINISTRATOR' as const), eq(users.isActive, true), isNull(users.deletedAt))) as unknown as Promise<unknown>);
        const cnt = Array.isArray(res) ? (res as Array<{ count: number }>)[0]?.count : (res as { count: number })?.count;
        if (Number(cnt ?? 2) <= 1) {
          throw new BadRequestException('Impossible de désactiver le dernier administrateur actif.');
        }
      } catch (e) {
        if (e instanceof BadRequestException) throw e;
      }
    }

    await this.drizzle.db.update(users).set({ isActive: false }).where(eq(users.id, id));

    const subject = await this.findSubject(id);
    if (subject) {
      await this.keycloakAdmin.setEnabled(subject, false);
    }

    this.logger.log(`Utilisateur désactivé: ${id}`);
    return { message: 'Utilisateur désactivé avec succès.' };
  }

  /**
   * Réactive un compte utilisateur désactivé.
   *
   * @param id Identifiant de l'utilisateur.
   * @throws BadRequestException Si l'utilisateur est déjà actif.
   */
  async activate(id: string) {
    const user = await this.findOne(id);

    if (user.isActive) {
      throw new BadRequestException('Cet utilisateur est déjà actif.');
    }

    await this.drizzle.db.update(users).set({ isActive: true }).where(eq(users.id, id));

    const subject = await this.findSubject(id);
    if (subject) {
      await this.keycloakAdmin.setEnabled(subject, true);
    }

    this.logger.log(`Utilisateur réactivé: ${id}`);
    return { message: 'Utilisateur réactivé avec succès.' };
  }

  /** Récupère le sujet Keycloak lié au profil (null si jamais provisionné). */
  private async findSubject(id: string): Promise<string | null> {
    const [row] = await this.drizzle.db
      .select({ keycloakSubjectId: users.keycloakSubjectId })
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);
    return row?.keycloakSubjectId ?? null;
  }

  /**
   * Mise en pause / reprise volontaire d'un agent (self-service).
   */
  async setAvailability(userId: string, available: boolean) {
    const user = await this.findOne(userId);
    if (available && user.isAvailable) {
      throw new BadRequestException('Cet utilisateur est déjà disponible.');
    }
    if (!available && user.isAvailable === false) {
      throw new BadRequestException('Cet utilisateur est déjà en pause.');
    }
    await this.drizzle.db.update(users).set({ isAvailable: available }).where(eq(users.id, userId));
    const data = await this.findOne(userId);
    return { message: available ? 'Disponibilité rétablie.' : 'Mise en pause effectuée.', data };
  }

  /**
   * Déclaration d'absence d'un agent. L'absence courte (<= 7 jours) est libre ;
   * une absence prolongée nécessite un rôle ADMINISTRATOR ou SUPERVISOR.
   */
  async setOwnAbsence(userId: string, absenceEndsAt?: Date | string | null, currentUser?: JwtPayload) {
    const end = absenceEndsAt ? new Date(absenceEndsAt) : null;
    if (end && Number.isNaN(end.getTime())) {
      throw new BadRequestException("La fin d'absence doit être une date valide.");
    }
    if (end && end <= new Date()) {
      throw new BadRequestException("La fin d'absence doit être dans le futur.");
    }
    const prolongedDays = 7;
    if (end && currentUser && !['ADMINISTRATOR', 'SUPERVISOR'].includes(currentUser.role)) {
      const maxSelfEnd = new Date(Date.now() + prolongedDays * 24 * 60 * 60 * 1000);
      if (end > maxSelfEnd) {
        throw new ForbiddenException(
          `Une absence prolongée (> ${prolongedDays} jours) doit être déclarée par un administrateur ou superviseur.`,
        );
      }
    }
    await this.drizzle.db
      .update(users)
      .set({ absenceEndsAt: end, ...(end ? { isAvailable: false } : {}) })
      .where(eq(users.id, userId));
    const data = await this.findOne(userId);
    return { message: end ? 'Absence enregistrée.' : 'Absence annulée.', data };
  }

  /**
   * Envoie l'email de bienvenue avec le mot de passe temporaire via la file d'attente BullMQ.
   */
  private async sendWelcomeEmail(
    to: string,
    firstName: string,
    lastName: string,
    tempPassword: string,
    role: string,
    departmentName: string,
  ): Promise<void> {
    // Avec Keycloak unique, la connexion passe par le frontend interne (SSO).
    const loginUrl = process.env['LOGIN_URL'] || 'http://localhost:3007/login';
    try {
      await this.queues.email.add('send-email', {
        to,
        subject: '👤 Votre compte Telecom Ticket Management',
        template: 'accountCreated',
        data: {
          firstName,
          lastName,
          email: to,
          role,
          departmentName,
          temporaryPassword: tempPassword,
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
