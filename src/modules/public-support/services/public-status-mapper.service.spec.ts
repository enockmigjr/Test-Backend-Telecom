import { TicketStatus } from '../../tickets/domain/ticket-status-transitions';
import { PublicStatusMapperService } from './public-status-mapper.service';

describe('PublicStatusMapperService', () => {
  const service = new PublicStatusMapperService();

  it.each<[TicketStatus, string]>([
    ['NEW', 'RECEIVED'],
    ['ASSIGNED', 'RECEIVED'],
    ['IN_PROGRESS', 'IN_PROGRESS'],
    ['REOPENED', 'IN_PROGRESS'],
    ['PENDING_THIRD_PARTY', 'IN_PROGRESS'],
    ['PENDING_CUSTOMER', 'WAITING_FOR_CUSTOMER'],
    ['RESOLVED', 'RESOLVED'],
    ['CLOSED', 'CLOSED'],
    ['CANCELLED', 'CLOSED'],
  ])('mappe %s vers le statut public %s', (internalStatus, publicStatus) => {
    expect(service.map(internalStatus)).toBe(publicStatus);
  });
});
