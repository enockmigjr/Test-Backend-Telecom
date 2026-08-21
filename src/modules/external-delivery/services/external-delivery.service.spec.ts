import { Test } from '@nestjs/testing';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { IntegrationSecretCipherService } from '../../support-integrations/services/integration-secret-cipher.service';
import { EMAIL_CHANNEL_ADAPTER } from '../interfaces/channel-adapter.interface';
import { ExternalDeliveryService } from './external-delivery.service';

describe('ExternalDeliveryService (rejeu après panne)', () => {
  const rows = [
    { id: 'delivery-1', outboxEventId: 'outbox-1' },
    { id: 'delivery-2', outboxEventId: 'outbox-2' },
  ];
  const updateSet = jest.fn(() => ({ where: jest.fn(async () => undefined) }));
  const db = {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({ limit: jest.fn(async () => rows) })),
      })),
    })),
    update: jest.fn(() => ({ set: updateSet })),
  };
  const queueAdd = jest.fn(async () => undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    queueAdd.mockResolvedValue(undefined);
  });

  async function buildService() {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ExternalDeliveryService,
        {
          provide: DrizzleProvider,
          useValue: { db, runInTransaction: (callback: () => unknown) => callback() },
        },
        { provide: IntegrationSecretCipherService, useValue: { open: jest.fn(), seal: jest.fn() } },
        { provide: EMAIL_CHANNEL_ADAPTER, useValue: { deliver: jest.fn() } },
        { provide: 'BullMQ_Queues', useValue: { externalDelivery: { add: queueAdd } } },
      ],
    }).compile();
    return moduleRef.get(ExternalDeliveryService);
  }

  it('rejoue les livraisons FAILED en les repassant PENDING puis en ré-ajoutant un job sans jobId', async () => {
    const service = await buildService();
    await service.requeueFailedDeliveries();
    expect(db.select).toHaveBeenCalled();
    expect(db.update).toHaveBeenCalledTimes(2);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PENDING', lastError: 'REQUEUED_AFTER_RECOVERY' }),
    );
    expect(queueAdd).toHaveBeenCalledTimes(2);
    expect(queueAdd).toHaveBeenCalledWith('dispatch-outbox-event', { outboxEventId: 'outbox-1' }, expect.objectContaining({ jobId: expect.stringContaining('retry-') }));
    expect(queueAdd).toHaveBeenCalledWith('dispatch-outbox-event', { outboxEventId: 'outbox-2' }, expect.objectContaining({ jobId: expect.stringContaining('retry-') }));
  });
});
