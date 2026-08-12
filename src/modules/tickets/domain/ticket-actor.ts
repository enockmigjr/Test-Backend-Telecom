import { isRecord } from '../../../common/utils/helpers';

export type TicketActor =
  | { readonly type: 'INTERNAL'; readonly userId: string }
  | {
      readonly type: 'EXTERNAL_REQUESTER';
      readonly externalRequesterId: string;
      readonly supportIntegrationId: string;
    }
  | { readonly type: 'SYSTEM' };

export interface TicketActorColumns {
  readonly actorType: TicketActor['type'];
  readonly userId: string | null;
  readonly externalRequesterId: string | null;
  readonly supportIntegrationId: string | null;
}

/** Construit un acteur interne sans exposer les détails de persistance. */
export function internalActor(userId: string): TicketActor {
  requireIdentifier(userId, 'userId');
  return { type: 'INTERNAL', userId };
}

/** Acteur des automatisations; aucun compte administrateur fictif n'est requis. */
export function systemActor(): TicketActor {
  return { type: 'SYSTEM' };
}

/** Valide une valeur provenant d'une frontière non typée avant de l'utiliser comme acteur. */
export function parseTicketActor(value: unknown): TicketActor {
  if (!isRecord(value) || typeof value['type'] !== 'string') throw new TypeError('Acteur de ticket invalide.');
  if (value['type'] === 'SYSTEM' && exactKeys(value, ['type'])) return systemActor();
  if (value['type'] === 'INTERNAL' && exactKeys(value, ['type', 'userId']) && isIdentifier(value['userId'])) {
    return internalActor(value['userId']);
  }
  if (
    value['type'] === 'EXTERNAL_REQUESTER' &&
    exactKeys(value, ['type', 'externalRequesterId', 'supportIntegrationId']) &&
    isIdentifier(value['externalRequesterId']) &&
    isIdentifier(value['supportIntegrationId'])
  ) {
    return {
      type: 'EXTERNAL_REQUESTER',
      externalRequesterId: value['externalRequesterId'],
      supportIntegrationId: value['supportIntegrationId'],
    };
  }
  throw new TypeError('Combinaison de références acteur invalide.');
}

/** Traduit l'union stricte vers les colonnes communes des tables historiques. */
export function toTicketActorColumns(actor: TicketActor, contextIntegrationId?: string): TicketActorColumns {
  if (actor.type === 'INTERNAL') {
    return {
      actorType: actor.type,
      userId: actor.userId,
      externalRequesterId: null,
      supportIntegrationId: contextIntegrationId ?? null,
    };
  }
  if (actor.type === 'EXTERNAL_REQUESTER') {
    if (contextIntegrationId && contextIntegrationId !== actor.supportIntegrationId) {
      throw new TypeError("L'acteur externe n'appartient pas à l'intégration du contexte.");
    }
    return {
      actorType: actor.type,
      userId: null,
      externalRequesterId: actor.externalRequesterId,
      supportIntegrationId: actor.supportIntegrationId,
    };
  }
  return {
    actorType: actor.type,
    userId: null,
    externalRequesterId: null,
    supportIntegrationId: contextIntegrationId ?? null,
  };
}

function exactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const actual = Object.keys(value).sort();
  return (
    actual.length === expected.length &&
    expected
      .slice()
      .sort()
      .every((key, index) => key === actual[index])
  );
}

function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function requireIdentifier(value: string, name: string): void {
  if (!isIdentifier(value)) throw new TypeError(`${name} doit être un identifiant non vide.`);
}
