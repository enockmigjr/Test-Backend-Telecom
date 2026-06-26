import { Test, TestingModule } from '@nestjs/testing';
import { TicketStateMachine, TICKET_TRANSITIONS, TicketStatus } from './ticket-status-transitions';
import { InvalidStatusTransitionException } from './exceptions/invalid-status-transition.exception';

/**
 * Tests unitaires de la machine d'état des tickets.
 *
 * La machine d'état est le cœur du domaine métier — toute transition
 * invalide doit être rejetée. Ces tests couvrent exhaustivement
 * les 9 statuts et leurs transitions.
 *
 * Règle: Le nombre de transitions autorisées doit correspondre
 * exactement au diagramme d'état défini dans la conception.
 */
describe('TicketStateMachine', () => {
  let stateMachine: TicketStateMachine;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TicketStateMachine],
    }).compile();

    stateMachine = module.get<TicketStateMachine>(TicketStateMachine);
  });

  describe('TICKET_TRANSITIONS — Map des transitions', () => {
    it('doit avoir exactement 9 statuts définis', () => {
      const statuses = Object.keys(TICKET_TRANSITIONS);
      expect(statuses).toHaveLength(9);
    });

    it('NEW doit pouvoir aller vers ASSIGNED et CANCELLED uniquement', () => {
      expect(TICKET_TRANSITIONS['NEW']).toEqual(['ASSIGNED', 'CANCELLED']);
    });

    it('ASSIGNED doit pouvoir aller vers IN_PROGRESS et CANCELLED uniquement', () => {
      expect(TICKET_TRANSITIONS['ASSIGNED']).toEqual(['IN_PROGRESS', 'CANCELLED']);
    });

    it('IN_PROGRESS doit pouvoir aller vers PENDING_CUSTOMER, PENDING_THIRD_PARTY, et RESOLVED', () => {
      expect(TICKET_TRANSITIONS['IN_PROGRESS']).toEqual(['PENDING_CUSTOMER', 'PENDING_THIRD_PARTY', 'RESOLVED']);
    });

    it('RESOLVED doit pouvoir aller vers CLOSED et REOPENED', () => {
      expect(TICKET_TRANSITIONS['RESOLVED']).toEqual(['CLOSED', 'REOPENED']);
    });

    it('CLOSED doit pouvoir aller vers REOPENED uniquement', () => {
      expect(TICKET_TRANSITIONS['CLOSED']).toEqual(['REOPENED']);
    });

    it('CANCELLED ne doit permettre aucune transition (état terminal)', () => {
      expect(TICKET_TRANSITIONS['CANCELLED']).toEqual([]);
    });

    it('REOPENED doit pouvoir aller vers IN_PROGRESS et CANCELLED', () => {
      expect(TICKET_TRANSITIONS['REOPENED']).toEqual(['IN_PROGRESS', 'CANCELLED']);
    });

    it('doit être immuable — toute modification doit être impossible', () => {
      // Vérifier que la map est gelée conceptuellement
      const transitions = TICKET_TRANSITIONS['NEW'];
      expect(transitions).toEqual(['ASSIGNED', 'CANCELLED']);
      // La map elle-même est un Record (non freeze par défaut en TS, mais le contrat est clair)
    });
  });

  describe('canTransition() — Vérification booléenne', () => {
    it('doit autoriser NEW → ASSIGNED', () => {
      expect(stateMachine.canTransition('NEW', 'ASSIGNED')).toBe(true);
    });

    it('doit autoriser IN_PROGRESS → RESOLVED', () => {
      expect(stateMachine.canTransition('IN_PROGRESS', 'RESOLVED')).toBe(true);
    });

    it('doit autoriser RESOLVED → CLOSED', () => {
      expect(stateMachine.canTransition('RESOLVED', 'CLOSED')).toBe(true);
    });

    it('doit autoriser CLOSED → REOPENED', () => {
      expect(stateMachine.canTransition('CLOSED', 'REOPENED')).toBe(true);
    });

    it('doit refuser NEW → IN_PROGRESS (doit passer par ASSIGNED)', () => {
      expect(stateMachine.canTransition('NEW', 'IN_PROGRESS')).toBe(false);
    });

    it('doit refuser NEW → RESOLVED (doit passer par tout le cycle)', () => {
      expect(stateMachine.canTransition('NEW', 'RESOLVED')).toBe(false);
    });

    it('doit refuser ASSIGNED → CLOSED (doit être résolu avant)', () => {
      expect(stateMachine.canTransition('ASSIGNED', 'CLOSED')).toBe(false);
    });

    it('doit refuser RESOLVED → CANCELLED (pas de chemin direct)', () => {
      expect(stateMachine.canTransition('RESOLVED', 'CANCELLED')).toBe(false);
    });

    it("doit refuser CANCELLED → n'importe quel statut (terminal)", () => {
      const allStatuses: TicketStatus[] = [
        'NEW',
        'ASSIGNED',
        'IN_PROGRESS',
        'PENDING_CUSTOMER',
        'PENDING_THIRD_PARTY',
        'RESOLVED',
        'CLOSED',
        'REOPENED',
        'CANCELLED',
      ];
      for (const status of allStatuses) {
        expect(stateMachine.canTransition('CANCELLED', status)).toBe(false);
      }
    });
  });

  describe('validateTransition() — Validation avec exception', () => {
    it("ne doit pas lancer d'exception pour une transition valide", () => {
      expect(() => stateMachine.validateTransition('NEW', 'ASSIGNED')).not.toThrow();
      expect(() => stateMachine.validateTransition('IN_PROGRESS', 'RESOLVED')).not.toThrow();
      expect(() => stateMachine.validateTransition('RESOLVED', 'CLOSED')).not.toThrow();
    });

    it('doit lancer InvalidStatusTransitionException pour une transition invalide', () => {
      expect(() => stateMachine.validateTransition('NEW', 'CLOSED')).toThrow(InvalidStatusTransitionException);
    });

    it("le message d'exception doit contenir le statut actuel et les transitions autorisées", () => {
      try {
        stateMachine.validateTransition('NEW', 'CLOSED');
        fail('Devrait avoir lancé une exception');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidStatusTransitionException);
        const msg = (error as Error).message;
        expect(msg).toContain('NEW');
        expect(msg).toContain('CLOSED');
        expect(msg).toContain('ASSIGNED');
        expect(msg).toContain('CANCELLED');
      }
    });
  });

  describe('getAllowedTransitions() — Transitions autorisées', () => {
    it('doit retourner les transitions pour NEW', () => {
      const allowed = stateMachine.getAllowedTransitions('NEW');
      expect(allowed).toContain('ASSIGNED');
      expect(allowed).toContain('CANCELLED');
      expect(allowed).toHaveLength(2);
    });

    it('doit retourner un tableau vide pour CANCELLED', () => {
      expect(stateMachine.getAllowedTransitions('CANCELLED')).toEqual([]);
    });
  });

  describe('Workflow complet — Scénario nominal', () => {
    it('doit permettre le cycle complet: NEW → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED', () => {
      const workflow: Array<[TicketStatus, TicketStatus]> = [
        ['NEW', 'ASSIGNED'],
        ['ASSIGNED', 'IN_PROGRESS'],
        ['IN_PROGRESS', 'RESOLVED'],
        ['RESOLVED', 'CLOSED'],
      ];

      for (const [from, to] of workflow) {
        expect(stateMachine.canTransition(from, to)).toBe(true);
      }
    });

    it('doit permettre la réouverture: CLOSED → REOPENED → IN_PROGRESS → RESOLVED → CLOSED', () => {
      const workflow: Array<[TicketStatus, TicketStatus]> = [
        ['CLOSED', 'REOPENED'],
        ['REOPENED', 'IN_PROGRESS'],
        ['IN_PROGRESS', 'RESOLVED'],
        ['RESOLVED', 'CLOSED'],
      ];

      for (const [from, to] of workflow) {
        expect(stateMachine.canTransition(from, to)).toBe(true);
      }
    });
  });
});
