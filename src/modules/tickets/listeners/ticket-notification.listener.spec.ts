import { DrizzleProvider } from '../../../database/drizzle.provider';
import { TelecomWebSocketGateway } from '../../../websocket/websocket.gateway';
import { TicketCreatedEvent } from '../domain/ticket.events';
import { TicketNotificationListener } from './ticket-notification.listener';

describe('TicketNotificationListener — isolation temps réel', () => {
  it("notifie le département propriétaire et l'équipe assignée sans room globale", async () => {
    const limit = jest.fn().mockResolvedValue([]);
    const drizzle = {
      db: { select: jest.fn(() => ({ from: jest.fn(() => ({ where: jest.fn(() => ({ limit })) })) })) },
    } as unknown as DrizzleProvider;
    const gateway = {
      emitToDepartment: jest.fn(),
      emitToUser: jest.fn(),
    } as unknown as TelecomWebSocketGateway;
    const queues = {
      email: { add: jest.fn() },
      notification: { add: jest.fn() },
    };
    const listener = new TicketNotificationListener(queues as never, drizzle, gateway);
    const event = new TicketCreatedEvent(
      {
        id: 'ticket-001',
        ticketNumber: 'TKT-001',
        title: 'Panne fibre',
        priority: 'HIGH',
        category: 'Réseau',
        departmentId: 'dept-owner',
        assignedTeamId: 'dept-target',
      },
      'user-001',
    );

    await listener.handleTicketCreated(event);

    expect(gateway.emitToDepartment).toHaveBeenCalledTimes(2);
    expect(gateway.emitToDepartment).toHaveBeenCalledWith('dept-owner', 'ticket.created', expect.any(Object));
    expect(gateway.emitToDepartment).toHaveBeenCalledWith('dept-target', 'ticket.created', expect.any(Object));
  });
});
