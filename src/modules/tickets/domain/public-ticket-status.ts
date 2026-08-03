import { TicketStatus } from './ticket-status-transitions';

export type PublicTicketStatus = 'RECEIVED' | 'IN_PROGRESS' | 'WAITING_FOR_CUSTOMER' | 'RESOLVED' | 'CLOSED';

export function toPublicTicketStatus(status: TicketStatus): PublicTicketStatus {
  switch (status) {
    case 'NEW':
    case 'ASSIGNED':
      return 'RECEIVED';
    case 'IN_PROGRESS':
    case 'REOPENED':
    case 'PENDING_THIRD_PARTY':
      return 'IN_PROGRESS';
    case 'PENDING_CUSTOMER':
      return 'WAITING_FOR_CUSTOMER';
    case 'RESOLVED':
      return 'RESOLVED';
    case 'CLOSED':
    case 'CANCELLED':
      return 'CLOSED';
  }
}
