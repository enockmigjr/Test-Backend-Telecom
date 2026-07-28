import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { JwtPayload } from '../../modules/auth/interfaces/jwt-payload.interface';
import { TicketAccessService } from '../services/ticket-access.service';

interface TicketRequest {
  user?: JwtPayload;
  params: { id?: string; ticketId?: string };
}

@Injectable()
export class DepartmentAbacGuard implements CanActivate {
  constructor(private readonly ticketAccess: TicketAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<TicketRequest>();
    const user = request.user;
    if (!user) throw new ForbiddenException('Authentification requise.');

    const ticketId = request.params.id || request.params.ticketId;
    if (!ticketId) return true;

    await this.ticketAccess.assertTicketVisible(ticketId, user);
    return true;
  }
}
