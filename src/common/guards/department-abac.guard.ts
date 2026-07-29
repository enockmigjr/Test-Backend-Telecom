/**
 * ============================================================================
 * FICHIER : src/common/guards/department-abac.guard.ts
 * RÔLE : Guard de sécurité basé sur les attributs (ABAC - Attribute-Based Access Control).
 * EXPLICATION :
 * Ce guard vérifie l'isolation des données entre les départements et techniciens :
 * Un technicien du service Support ne doit pas voir les tickets du service Facturation,
 * sauf s'il en est le créateur ou l'assigné direct.
 * Si l'accès n'est pas permis, le guard lève une exception d'accès interdit (403 Forbidden).
 * ============================================================================
 */

import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { JwtPayload } from '../../modules/auth/interfaces/jwt-payload.interface';
import { TicketAccessService } from '../services/ticket-access.service';

/** Interface décrivant la forme d'une requête HTTP ciblant un ticket */
interface TicketRequest {
  user?: JwtPayload;
  params: { id?: string; ticketId?: string };
}

/**
 * Class DepartmentAbacGuard
 */
@Injectable()
export class DepartmentAbacGuard implements CanActivate {
  constructor(private readonly ticketAccess: TicketAccessService) {}

  /**
   * Vérifie si l'utilisateur a le droit d'accéder au ticket demandé dans la requête HTTP.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<TicketRequest>();
    const user = request.user;
    if (!user) throw new ForbiddenException('Authentification requise.');

    const ticketId = request.params.id || request.params.ticketId;
    if (!ticketId) return true;

    // Vérification approfondie via le service central de contrôle des accès
    await this.ticketAccess.assertTicketVisible(ticketId, user);
    return true;
  }
}
