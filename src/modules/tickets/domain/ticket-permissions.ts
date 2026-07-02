import { Injectable, ForbiddenException } from '@nestjs/common';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

export interface TicketPermissionData {
  id: string;
  createdBy: string;
  assignedTo: string | null;
  assignedTeamId: string;
  departmentId: string;
  status: string;
  closedAt: Date | null;
}

@Injectable()
export class TicketPermissions {
  /**
   * Verifie les permissions de modification fine par champ (PATCH).
   */
  checkCanUpdateFields(ticket: TicketPermissionData, user: JwtPayload, updatedFields: string[]): void {
    const isOwner = ticket.createdBy === user.sub;
    const isAssignee = ticket.assignedTo === user.sub;
    const isSupervisor = user.role === 'SUPERVISOR';
    const isAdmin = user.role === 'ADMINISTRATOR';

    for (const field of updatedFields) {
      if (field === 'title' || field === 'description') {
        if (!isOwner && !isAssignee && !isSupervisor && !isAdmin) {
          throw new ForbiddenException(`Vous n'avez pas le droit de modifier le titre ou la description de ce ticket.`);
        }
      } else if (field === 'status') {
        if (!isAssignee && !isSupervisor && !isAdmin) {
          throw new ForbiddenException(
            `Seul l'assigne, un superviseur ou un administrateur peut modifier le statut de ce ticket.`,
          );
        }
      } else if (field === 'priority' || field === 'severity') {
        if (!isSupervisor && !isAdmin) {
          throw new ForbiddenException(
            `Seul un superviseur ou un administrateur peut modifier la priorite ou la severite.`,
          );
        }
      } else if (field === 'category') {
        const isNew = ticket.status === 'NEW';
        if (!(isOwner && isNew) && !isSupervisor && !isAdmin) {
          throw new ForbiddenException(
            `Seul le createur (lorsque le ticket est NEW), un superviseur ou un administrateur peut modifier la categorie.`,
          );
        }
      } else if (field === 'resolutionSummary' || field === 'tags' || field === 'metadata') {
        if (!isAssignee && !isSupervisor && !isAdmin) {
          throw new ForbiddenException(`Seul l'assigne, un superviseur ou un administrateur peut modifier ce champ.`);
        }
      } else if (field === 'assignedTo') {
        if (!isSupervisor && !isAdmin) {
          throw new ForbiddenException(`Seul un superviseur ou un administrateur peut assigner directement.`);
        }
      } else if (field === 'slaPolicyId') {
        if (!isAdmin) {
          throw new ForbiddenException(`Seul un administrateur peut modifier la politique SLA.`);
        }
      }
    }
  }

  /**
   * Verifie si l'utilisateur a le droit d'assigner ou de se faire assigner le ticket.
   */
  checkCanAssign(ticket: TicketPermissionData, toUserId: string, user: JwtPayload): { isAutoAssign: boolean } {
    const isAdmin = user.role === 'ADMINISTRATOR';
    const isSupervisor = user.role === 'SUPERVISOR';
    const isSelfAssign = toUserId === user.sub;

    // S'auto-assigner (si ticket NEW et non assigne)
    if (isSelfAssign) {
      const isNew = ticket.status === 'NEW';
      const isUnassigned = !ticket.assignedTo;
      if (isNew && isUnassigned) {
        return { isAutoAssign: true };
      }
    }

    // Assigner a quelqu'un d'autre ou reassigner un ticket deja assigne
    const isAlreadyAssigned = !!ticket.assignedTo;
    const isAssignee = ticket.assignedTo === user.sub;

    if (isAlreadyAssigned) {
      // Reassigner
      if (!isSupervisor && !isAdmin && !isAssignee) {
        throw new ForbiddenException(
          `Seul un superviseur, un administrateur ou l'assigne actuel peut reassigner ce ticket.`,
        );
      }
    } else {
      // Assigner a quelqu'un d'autre alors que non assigne
      if (!isSupervisor && !isAdmin) {
        throw new ForbiddenException(`Seul un superviseur ou un administrateur peut assigner ce ticket a un tiers.`);
      }
    }

    return { isAutoAssign: false };
  }

  /**
   * Verifie si l'utilisateur a le droit d'escalader le ticket.
   */
  checkCanEscalate(
    ticket: TicketPermissionData,
    toDepartmentId: string,
    user: JwtPayload,
  ): { isHierarchical: boolean } {
    const isAdmin = user.role === 'ADMINISTRATOR';
    const isSupervisor = user.role === 'SUPERVISOR';
    const isAssignee = ticket.assignedTo === user.sub;

    // Escalade fonctionnelle (changement de departement)
    const isFunctional = toDepartmentId !== ticket.assignedTeamId;

    if (isFunctional) {
      if (!isSupervisor && !isAdmin) {
        throw new ForbiddenException(
          `Seul un superviseur ou un administrateur peut effectuer une escalade fonctionnelle (changement de departement).`,
        );
      }
      return { isHierarchical: false };
    }

    // Escalade hierarchique/technique (meme departement)
    if (!isAssignee && !isSupervisor && !isAdmin) {
      throw new ForbiddenException(
        `Seul l'assigne actuel, un superviseur ou un administrateur peut effectuer une escalade hierarchique.`,
      );
    }

    return { isHierarchical: true };
  }

  /**
   * Verifie si l'utilisateur a le droit de clore le ticket.
   */
  checkCanClose(ticket: TicketPermissionData, user: JwtPayload): void {
    const isAdmin = user.role === 'ADMINISTRATOR';
    const isSupervisor = user.role === 'SUPERVISOR';
    const isAssignee = ticket.assignedTo === user.sub;

    if (!isAssignee && !isSupervisor && !isAdmin) {
      throw new ForbiddenException(
        `Seul l'assigne du ticket, un superviseur ou un administrateur peut clore ce ticket.`,
      );
    }
  }

  /**
   * Verifie si l'utilisateur a le droit de rouvrir le ticket.
   */
  checkCanReopen(ticket: TicketPermissionData, user: JwtPayload): void {
    const isAdmin = user.role === 'ADMINISTRATOR';
    const isSupervisor = user.role === 'SUPERVISOR';
    const isCSAgent = user.role === 'CUSTOMER_SERVICE_AGENT';
    const isCreator = ticket.createdBy === user.sub;

    if (!isSupervisor && !isAdmin && !(isCSAgent && isCreator)) {
      throw new ForbiddenException(
        `Seul le createur du ticket (role Customer Service Agent), un superviseur ou un administrateur peut rouvrir ce ticket.`,
      );
    }

    // Contrainte temporelle : 30 jours max apres la cloture (sauf admin/supervisor)
    if (ticket.closedAt && !isAdmin && !isSupervisor) {
      const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
      const timeSinceClosed = Date.now() - new Date(ticket.closedAt).getTime();
      if (timeSinceClosed > thirtyDaysInMs) {
        throw new ForbiddenException(
          `Un ticket ferme depuis plus de 30 jours ne peut plus etre rouvert sans autorisation administrative.`,
        );
      }
    }
  }
}
