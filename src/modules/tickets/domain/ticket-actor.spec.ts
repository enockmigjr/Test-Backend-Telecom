import { internalActor, parseTicketActor, systemActor, toTicketActorColumns } from './ticket-actor';

describe('TicketActor', () => {
  it('traduit les trois variantes vers des colonnes mutuellement exclusives', () => {
    expect(toTicketActorColumns(internalActor('user-1'))).toEqual({
      actorType: 'INTERNAL',
      userId: 'user-1',
      externalRequesterId: null,
      supportIntegrationId: null,
    });
    expect(toTicketActorColumns(systemActor(), 'integration-1')).toEqual({
      actorType: 'SYSTEM',
      userId: null,
      externalRequesterId: null,
      supportIntegrationId: 'integration-1',
    });
    expect(
      toTicketActorColumns(
        parseTicketActor({
          type: 'EXTERNAL_REQUESTER',
          externalRequesterId: 'requester-1',
          supportIntegrationId: 'integration-1',
        }),
      ),
    ).toEqual({
      actorType: 'EXTERNAL_REQUESTER',
      userId: null,
      externalRequesterId: 'requester-1',
      supportIntegrationId: 'integration-1',
    });
  });

  it.each([
    null,
    {},
    { type: 'INTERNAL' },
    { type: 'INTERNAL', userId: 'user-1', externalRequesterId: 'requester-1' },
    { type: 'EXTERNAL_REQUESTER', externalRequesterId: 'requester-1' },
    { type: 'SYSTEM', userId: 'fake-admin' },
  ])('refuse une combinaison invalide: %p', (value) => {
    expect(() => parseTicketActor(value)).toThrow(TypeError);
  });

  it("refuse le croisement d'intégrations", () => {
    const actor = parseTicketActor({
      type: 'EXTERNAL_REQUESTER',
      externalRequesterId: 'requester-1',
      supportIntegrationId: 'integration-a',
    });
    expect(() => toTicketActorColumns(actor, 'integration-b')).toThrow(/intégration/);
  });
});
