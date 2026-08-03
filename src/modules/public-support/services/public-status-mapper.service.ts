import { Injectable } from '@nestjs/common';
import { PublicTicketStatus, toPublicTicketStatus } from '../../tickets/domain/public-ticket-status';
import { TicketStatus } from '../../tickets/domain/ticket-status-transitions';

@Injectable()
export class PublicStatusMapperService {
  map(status: TicketStatus): PublicTicketStatus {
    return toPublicTicketStatus(status);
  }
}
