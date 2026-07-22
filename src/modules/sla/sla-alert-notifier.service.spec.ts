import { MetricsService } from '../../common/metrics/metrics.service';
import { BullMqQueues } from '../../queues/queues.types';
import { TelecomWebSocketGateway } from '../../websocket/websocket.gateway';
import { SlaAlertNotifierService } from './sla-alert-notifier.service';
import { SlaAlertTicket } from './sla-alert.types';

describe('SlaAlertNotifierService', () => {
  const add = jest.fn().mockResolvedValue(undefined);
  const wsGateway = { emitToDepartment: jest.fn(), emitToUser: jest.fn() };
  const metrics = { slaBreachesTotal: { inc: jest.fn() } };
  const queues = { email: { add }, notification: { add } };
  const ticket: SlaAlertTicket = {
    id: 'ticket-001',
    ticketNumber: 'INC-001',
    title: 'Incident reseau',
    priority: 'HIGH',
    status: 'ASSIGNED',
    severity: 'S2',
    categoryName: 'NETWORK',
    departmentName: 'NOC',
    departmentId: 'dept-noc',
    assignedTo: 'agent-001',
    dueAt: new Date('2026-07-22T12:00:00Z'),
    assigneeEmail: null,
    assigneeFirstName: null,
    assigneeLastName: null,
  };
  let service: SlaAlertNotifierService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SlaAlertNotifierService(
      metrics as unknown as MetricsService,
      wsGateway as unknown as TelecomWebSocketGateway,
      queues as unknown as BullMqQueues,
    );
  });

  it('borne les warnings au departement du ticket et a son assigne', async () => {
    await service.notifyWarning(ticket, 'RESOLUTION', new Date('2026-07-22T11:45:00Z'));

    expect(wsGateway.emitToDepartment).toHaveBeenCalledWith('dept-noc', 'ticket.sla_warning', expect.any(Object));
    expect(wsGateway.emitToUser).toHaveBeenCalledWith('agent-001', 'ticket.sla_warning', expect.any(Object));
  });

  it('borne les breaches au departement du ticket et a son assigne', async () => {
    await service.notifyBreach(ticket, 'RESOLUTION', new Date('2026-07-22T12:15:00Z'));

    expect(wsGateway.emitToDepartment).toHaveBeenCalledWith('dept-noc', 'ticket.sla_breached', expect.any(Object));
    expect(wsGateway.emitToUser).toHaveBeenCalledWith('agent-001', 'ticket.sla_breached', expect.any(Object));
  });
});
