import { Injectable, CanActivate, ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { eq, and, isNull } from 'drizzle-orm';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { tickets } from '../../database/schemas';

/**
 * Guard ABAC (Attribute-Based Access Control) par Département.
 * Isole les tickets par département pour les agents techniques.
 *
 * Règles d'accès :
 * Un utilisateur peut accéder à un ticket SI :
 * 1. Il possède le rôle ADMINISTRATOR ou SUPERVISOR (portée globale par défaut).
 * 2. OU le ticket appartient à son département d'origine (departmentId === user.departmentId).
 * 3. OU le ticket est affecté à son département pour résolution (assignedTeamId === user.departmentId).
 * 4. OU il est l'agent explicitement assigné au ticket (assignedTo === user.sub).
 * 5. OU il est le créateur du ticket (createdBy === user.sub).
 */
@Injectable()
export class DepartmentAbacGuard implements CanActivate {
  constructor(private readonly drizzle: DrizzleProvider) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // Injecté par JwtAuthGuard

    if (!user) {
      throw new ForbiddenException('Authentification requise.');
    }

    // Si l'utilisateur est administrateur global, l'accès est accordé par défaut
    if (user.role === 'ADMINISTRATOR') {
      return true;
    }

    // Récupérer l'ID du ticket depuis les paramètres
    const ticketId = request.params.id || request.params.ticketId;
    if (!ticketId) {
      // Pas d'ID de ticket spécifique dans la route (ex: création de ticket ou liste globale filtrée),
      // le contrôle d'accès de base s'applique (RolesGuard)
      return true;
    }

    // Charger le ticket pour comparer les attributs (Object Attributes)
    const [ticket] = await this.drizzle.db
      .select({
        id: tickets.id,
        departmentId: tickets.departmentId,
        assignedTeamId: tickets.assignedTeamId,
        assignedTo: tickets.assignedTo,
        createdBy: tickets.createdBy,
      })
      .from(tickets)
      .where(and(eq(tickets.id, ticketId), isNull(tickets.deletedAt)))
      .limit(1);

    if (!ticket) {
      throw new NotFoundException('Ticket non trouvé ou supprimé.');
    }

    // Comparer les attributs du sujet (User) et de l'objet (Ticket)
    const isOwnerDept = ticket.departmentId === user.departmentId;
    const isAssignedDept = ticket.assignedTeamId === user.departmentId;
    const isAssignee = ticket.assignedTo === user.sub;
    const isCreator = ticket.createdBy === user.sub;

    if (isOwnerDept || isAssignedDept || isAssignee || isCreator) {
      return true;
    }

    throw new ForbiddenException(
      'Accès refusé : ce ticket appartient à un autre département et ne vous est pas assigné.',
    );
  }
}
