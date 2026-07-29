/**
 * ============================================================================
 * FICHIER : src/modules/tickets/tickets.controller.spec.ts
 * RÔLE : Suite de tests unitaires pour le composant tickets.controller.
 * EXPLICATION :
 * Ce fichier contient les tests automatisés validant le comportement et l'intégrité de tickets.controller.
 * 1. Vérifie le fonctionnement nominal et les cas d'erreur.
 * 2. Garantit qu'aucune régression n'est introduite lors des évolutions du code.
 * ============================================================================
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './services/tickets.service';
import { TicketsSearchService } from './services/tickets-search.service';
import { mock, MockProxy } from 'jest-mock-extended';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { SearchTicketsDto } from './dto/search-tickets.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { EscalateTicketDto } from './dto/escalate-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { DepartmentAbacGuard } from '../../common/guards/department-abac.guard';
import { TicketDetailsService } from './services/ticket-details.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const mockUser: JwtPayload = {
  sub: 'user-001',
  email: 'agent@telecom.local',
  role: 'CUSTOMER_SERVICE_AGENT',
  departmentId: 'dept-001',
  mustChangePassword: false,
  jti: 'jti-001',
};

const mockAdmin: JwtPayload = {
  sub: 'admin-001',
  email: 'admin@telecom.local',
  role: 'ADMINISTRATOR',
  departmentId: 'dept-001',
  mustChangePassword: false,
  jti: 'jti-002',
};

const ticketId = '0192abcd-1234-7000-8000-000000000001';

const createDto: CreateTicketDto = {
  title: 'Coupure fibre optique secteur Nord',
  description: 'Les clients du secteur Nord signalent une perte de connexion.',
  priority: 'HIGH',
  severity: 'S2',
  categoryId: '019f28ea-9e12-7cc0-a0ea-3d4de79e7a95',
  departmentId: 'dept-001',
  assignedTeamId: 'team-001',
  customerAccountNumber: 'ACC-001',
  customerName: 'Client Test',
  customerContact: 'contact@test.com',
  tags: 'fibre,urgent',
};

const updateDto: UpdateTicketDto = {
  title: 'Titre mis à jour',
  description: 'Description mise à jour',
  priority: 'MEDIUM',
};

const assignDto: AssignTicketDto = {
  userId: 'agent-002',
  reason: 'Assignation par compétence',
};

const escalateDto: EscalateTicketDto = {
  userId: 'senior-001',
  departmentId: 'dept-002',
  reason: 'Nécessite compétences avancées',
};

const searchFilters: SearchTicketsDto = {
  status: 'IN_PROGRESS',
  priority: 'HIGH',
  categoryId: '019f28ea-9e12-7cc0-a0ea-3d4de79e7a95',
  page: 1,
  limit: 20,
};

// Construction d'un ticket complet pour matcher le type de retour Drizzle
function buildFullTicket(overrides: Record<string, any> = {}): any {
  return {
    id: ticketId,
    ticketNumber: 'TT-2026-000001',
    title: 'Coupure fibre optique secteur Nord',
    description: 'Les clients du secteur Nord signalent une perte de connexion.',
    status: 'NEW' as const,
    priority: 'HIGH' as const,
    severity: 'S2' as const,
    categoryId: '019f28ea-9e12-7cc0-a0ea-3d4de79e7a95',
    categoryName: 'NETWORK',
    slaPolicyId: 'sla-001',
    customerAccountNumber: 'ACC-001',
    customerName: 'Client Test',
    customerContact: 'contact@test.com',
    departmentId: 'dept-001',
    assignedTeamId: 'team-001',
    createdBy: 'user-001',
    assignedTo: null,
    resolutionSummary: null,
    firstResponseAt: null,
    firstResponseDueAt: new Date('2026-01-01T01:00:00.000Z'),
    resolutionDueAt: new Date('2026-01-01T04:00:00.000Z'),
    resolvedAt: null,
    closedAt: null,
    tags: 'fibre,urgent',
    metadata: null,
    slaPausedAt: null,
    accumulatedPauseMs: 0,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    creatorName: 'Jean Dupont',
    assigneeName: null,
    departmentName: 'Support Technique',
    ...overrides,
  };
}

const ticketResponse = { message: 'Ticket créé avec succès.', data: buildFullTicket() };
const updateResponse = {
  message: 'Ticket mis à jour avec succès.',
  data: buildFullTicket({ title: 'Titre mis à jour' }),
};
const statusChangeResponse = {
  message: 'Statut changé : NEW → IN_PROGRESS',
  data: buildFullTicket({ status: 'IN_PROGRESS' as const }),
};
const resolvedResponse = {
  message: 'Statut changé : IN_PROGRESS → RESOLVED',
  data: buildFullTicket({ status: 'RESOLVED' as const }),
};
const closedResponse = {
  message: 'Statut changé : RESOLVED → CLOSED',
  data: buildFullTicket({ status: 'CLOSED' as const }),
};
const reopenedResponse = {
  message: 'Statut changé : CLOSED → REOPENED',
  data: buildFullTicket({ status: 'REOPENED' as const }),
};
const assignResponse = {
  message: 'Ticket assigné avec succès.',
  data: buildFullTicket({ assignedTo: 'agent-002', status: 'ASSIGNED' as const }),
};
const escalateResponse = {
  message: 'Ticket escaladé avec succès.',
  data: buildFullTicket({ assignedTo: 'senior-001', assignedTeamId: 'dept-002' }),
};
const historyResponse = [
  { id: 'hist-001', ticketId, action: 'TICKET_CREATED', userId: 'user-001', createdAt: new Date('2026-01-01') },
  {
    id: 'hist-002',
    ticketId,
    action: 'ASSIGNED',
    userId: 'admin-001',
    createdAt: new Date('2026-01-01T00:30:00.000Z'),
  },
];

const searchItem = {
  id: ticketId,
  ticketNumber: 'TT-2026-000001',
  title: 'Coupure fibre optique secteur Nord',
  status: 'NEW' as const,
  priority: 'HIGH' as const,
  severity: 'S2' as const,
  category: 'NETWORK' as const,
  assignedTo: null,
  customerName: 'Client Test',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const paginatedResult = {
  data: [searchItem],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

const detailedResponse = {
  data: {
    ...buildFullTicket(),
    _meta: { commentCount: 3, assignmentCount: 2 },
    assignmentHistory: [],
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('TicketsController', () => {
  let controller: TicketsController;
  let ticketsService: MockProxy<TicketsService>;
  let searchService: MockProxy<TicketsSearchService>;
  let ticketDetails: MockProxy<TicketDetailsService>;

  beforeEach(async () => {
    ticketsService = mock<TicketsService>();
    searchService = mock<TicketsSearchService>();
    ticketDetails = mock<TicketDetailsService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [
        { provide: TicketsService, useValue: ticketsService },
        { provide: TicketsSearchService, useValue: searchService },
        { provide: TicketDetailsService, useValue: ticketDetails },
      ],
    })
      .overrideGuard(DepartmentAbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TicketsController>(TicketsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // create() — POST /tickets
  // =========================================================================
  describe('POST /tickets — Create', () => {
    /** Test : doit creer un ticket avec les donnees fournies et le user JWT */
    it('doit creer un ticket avec les donnees fournies et le user JWT', async () => {
      ticketsService.create.mockResolvedValue(ticketResponse as any);

      const result = await controller.create(createDto, mockUser);

      expect(ticketsService.create).toHaveBeenCalledWith(createDto, mockUser.sub);
      expect(result).toEqual(ticketResponse);
    });

    /** Test : doit utiliser le sub du JWT comme createdBy */

    it('doit utiliser le sub du JWT comme createdBy', async () => {
      ticketsService.create.mockResolvedValue(ticketResponse as any);

      await controller.create(createDto, mockUser);

      expect(ticketsService.create).toHaveBeenCalledWith(createDto, 'user-001');
    });

    /** Test : doit propager les erreurs de validation du service */

    it('doit propager les erreurs de validation du service', async () => {
      ticketsService.create.mockRejectedValue(new Error('Aucune politique SLA trouvée pour NETWORK/HIGH'));

      await expect(controller.create(createDto, mockUser)).rejects.toThrow(
        'Aucune politique SLA trouvée pour NETWORK/HIGH',
      );
    });

    /** Test : doit retourner un objet avec message et data */

    it('doit retourner un objet avec message et data', async () => {
      ticketsService.create.mockResolvedValue(ticketResponse as any);

      const result = await controller.create(createDto, mockUser);

      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('data');
    });
  });

  // =========================================================================
  // search() — GET /tickets
  // =========================================================================
  describe('GET /tickets — Search', () => {
    /** Test : doit retourner une liste paginee de tickets */
    it('doit retourner une liste paginee de tickets', async () => {
      searchService.search.mockResolvedValue(paginatedResult as any);

      const result = await controller.search(searchFilters, mockUser);

      expect(searchService.search).toHaveBeenCalledWith(searchFilters, mockUser);
      expect(result).toEqual(paginatedResult);
    });

    /** Test : doit transmettre les filtres de recherche */

    it('doit transmettre les filtres de recherche', async () => {
      searchService.search.mockResolvedValue(paginatedResult as any);

      await controller.search(searchFilters, mockUser);

      expect(searchService.search).toHaveBeenCalledWith(
        {
          status: 'IN_PROGRESS',
          priority: 'HIGH',
          categoryId: '019f28ea-9e12-7cc0-a0ea-3d4de79e7a95',
          page: 1,
          limit: 20,
        },
        mockUser,
      );
    });

    /** Test : doit accepter des filtres vides */

    it('doit accepter des filtres vides', async () => {
      searchService.search.mockResolvedValue(paginatedResult as any);
      const emptyFilters = new SearchTicketsDto();

      await controller.search(emptyFilters, mockUser);

      expect(searchService.search).toHaveBeenCalledWith(emptyFilters, mockUser);
    });

    /** Test : doit retourner la structure paginee complete */

    it('doit retourner la structure paginee complete', async () => {
      searchService.search.mockResolvedValue(paginatedResult as any);

      const result = await controller.search(searchFilters, mockUser);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.meta).toHaveProperty('page');
      expect(result.meta).toHaveProperty('limit');
      expect(result.meta).toHaveProperty('total');
      expect(result.meta).toHaveProperty('totalPages');
    });

    /** Test : doit retourner un tableau vide si aucun ticket ne correspond */

    it('doit retourner un tableau vide si aucun ticket ne correspond', async () => {
      const emptyResult = { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } };
      searchService.search.mockResolvedValue(emptyResult as any);

      const result = await controller.search(searchFilters, mockUser);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  // =========================================================================
  // findOne() — GET /tickets/:id
  // =========================================================================
  describe('GET /tickets/:id — FindOne', () => {
    /** Test : doit retourner un ticket par son ID */
    it('doit retourner un ticket par son ID', async () => {
      ticketsService.findById.mockResolvedValue(ticketResponse as any);

      const result = await controller.findOne(ticketId, undefined);

      expect(ticketsService.findById).toHaveBeenCalledWith(ticketId);
      expect(result).toEqual(ticketResponse);
    });

    /** Test : doit retourner les details complets si detail=full */

    it('doit retourner les details complets si detail=full', async () => {
      ticketDetails.findById.mockResolvedValue(detailedResponse as any);

      const result = await controller.findOne(ticketId, 'full');

      expect(ticketDetails.findById).toHaveBeenCalledWith(ticketId, 1, 20);
      expect(ticketsService.findById).not.toHaveBeenCalled();
      expect(result).toEqual(detailedResponse);
    });

    /** Test : doit propager TicketNotFoundException */

    it('doit propager TicketNotFoundException', async () => {
      ticketsService.findById.mockRejectedValue(new Error('Ticket non trouvé.'));

      await expect(controller.findOne('id-inexistant', undefined)).rejects.toThrow('Ticket non trouvé.');
    });
  });

  // =========================================================================
  // update() — PATCH /tickets/:id
  // =========================================================================
  describe('PATCH /tickets/:id — Update', () => {
    /** Test : doit mettre a jour un ticket */
    it('doit mettre a jour un ticket', async () => {
      ticketsService.update.mockResolvedValue(updateResponse as any);

      const result = await controller.update(ticketId, updateDto, mockAdmin);

      expect(ticketsService.update).toHaveBeenCalledWith(ticketId, updateDto, mockAdmin);
      expect(result).toEqual(updateResponse);
    });

    /** Test : doit utiliser le sub du JWT pour tracer la modification */

    it('doit utiliser le sub du JWT pour tracer la modification', async () => {
      ticketsService.update.mockResolvedValue(updateResponse as any);

      await controller.update(ticketId, updateDto, mockAdmin);

      expect(ticketsService.update).toHaveBeenCalledWith(ticketId, updateDto, mockAdmin);
    });

    /** Test : doit propager les erreurs du service (not found, invalid data) */

    it('doit propager les erreurs du service (not found, invalid data)', async () => {
      ticketsService.update.mockRejectedValue(new Error('Ticket non trouvé.'));

      await expect(controller.update('id-inexistant', updateDto, mockAdmin)).rejects.toThrow('Ticket non trouvé.');
    });

    /** Test : doit retourner un message de confirmation */

    it('doit retourner un message de confirmation', async () => {
      ticketsService.update.mockResolvedValue(updateResponse as any);

      const result = await controller.update(ticketId, updateDto, mockAdmin);

      expect(result.message).toBe('Ticket mis à jour avec succès.');
    });
  });

  // =========================================================================
  // assign() — POST /tickets/:id/assign
  // =========================================================================
  describe('POST /tickets/:id/assign — Assign', () => {
    /** Test : doit assigner un ticket a un agent */
    it('doit assigner un ticket a un agent', async () => {
      ticketsService.assign.mockResolvedValue(assignResponse as any);

      const result = await controller.assign(ticketId, assignDto, mockAdmin);

      expect(ticketsService.assign).toHaveBeenCalledWith(ticketId, assignDto.userId, mockAdmin, assignDto.reason);
      expect(result).toEqual(assignResponse);
    });

    /** Test : doit utiliser le sub du JWT comme assignedBy */

    it('doit utiliser le sub du JWT comme assignedBy', async () => {
      ticketsService.assign.mockResolvedValue(assignResponse as any);

      await controller.assign(ticketId, assignDto, mockAdmin);

      expect(ticketsService.assign).toHaveBeenCalledWith(ticketId, assignDto.userId, mockAdmin, assignDto.reason);
    });

    /** Test : doit accepter une assignation sans raison */

    it('doit accepter une assignation sans raison', async () => {
      ticketsService.assign.mockResolvedValue(assignResponse as any);
      const dtoSansRaison: AssignTicketDto = { userId: 'agent-002' };

      await controller.assign(ticketId, dtoSansRaison, mockAdmin);

      expect(ticketsService.assign).toHaveBeenCalledWith(ticketId, 'agent-002', mockAdmin, undefined);
    });

    /** Test : doit propager les erreurs du service */

    it('doit propager les erreurs du service', async () => {
      ticketsService.assign.mockRejectedValue(new Error('Assignation impossible.'));

      await expect(controller.assign(ticketId, assignDto, mockAdmin)).rejects.toThrow('Assignation impossible.');
    });
  });

  // =========================================================================
  // escalate() — POST /tickets/:id/escalate
  // =========================================================================
  describe('POST /tickets/:id/escalate — Escalate', () => {
    /** Test : doit escalader un ticket vers un autre agent/departement */
    it('doit escalader un ticket vers un autre agent/departement', async () => {
      ticketsService.escalate.mockResolvedValue(escalateResponse as any);

      const result = await controller.escalate(ticketId, escalateDto, mockAdmin);

      expect(ticketsService.escalate).toHaveBeenCalledWith(
        ticketId,
        escalateDto.userId,
        escalateDto.departmentId,
        mockAdmin,
        escalateDto.reason,
      );
      expect(result).toEqual(escalateResponse);
    });

    /** Test : doit utiliser le sub du JWT comme escalatedBy */

    it('doit utiliser le sub du JWT comme escalatedBy', async () => {
      ticketsService.escalate.mockResolvedValue(escalateResponse as any);

      await controller.escalate(ticketId, escalateDto, mockAdmin);

      expect(ticketsService.escalate).toHaveBeenCalledWith(
        ticketId,
        escalateDto.userId,
        escalateDto.departmentId,
        mockAdmin,
        escalateDto.reason,
      );
    });

    /** Test : doit accepter une escalade sans raison */

    it('doit accepter une escalade sans raison', async () => {
      ticketsService.escalate.mockResolvedValue(escalateResponse as any);
      const dtoSansRaison: EscalateTicketDto = { userId: 'senior-001', departmentId: 'dept-002' };

      await controller.escalate(ticketId, dtoSansRaison, mockAdmin);

      expect(ticketsService.escalate).toHaveBeenCalledWith(ticketId, 'senior-001', 'dept-002', mockAdmin, undefined);
    });

    /** Test : doit propager les erreurs du service */

    it('doit propager les erreurs du service', async () => {
      ticketsService.escalate.mockRejectedValue(new Error("Echec de l'escalade."));

      await expect(controller.escalate(ticketId, escalateDto, mockAdmin)).rejects.toThrow("Echec de l'escalade.");
    });
  });

  // =========================================================================
  // start() — POST /tickets/:id/start
  // =========================================================================
  describe('POST /tickets/:id/start — Start', () => {
    /** Test : doit demarrer le traitement du ticket */
    it('doit demarrer le traitement du ticket', async () => {
      ticketsService.changeStatus.mockResolvedValue(statusChangeResponse as any);

      const result = await controller.start(ticketId, mockUser);

      expect(ticketsService.changeStatus).toHaveBeenCalledWith(ticketId, 'IN_PROGRESS', mockUser);
      expect(result).toEqual(statusChangeResponse);
    });

    /** Test : doit utiliser le sub du JWT */

    it('doit utiliser le sub du JWT', async () => {
      ticketsService.changeStatus.mockResolvedValue(statusChangeResponse as any);

      await controller.start(ticketId, mockUser);

      expect(ticketsService.changeStatus).toHaveBeenCalledWith(ticketId, 'IN_PROGRESS', mockUser);
    });

    /** Test : doit propager les erreurs de transition invalide */

    it('doit propager les erreurs de transition invalide', async () => {
      ticketsService.changeStatus.mockRejectedValue(new Error('Transition invalide.'));

      await expect(controller.start(ticketId, mockUser)).rejects.toThrow('Transition invalide.');
    });
  });

  // =========================================================================
  // resolve() — POST /tickets/:id/resolve
  // =========================================================================
  describe('POST /tickets/:id/resolve — Resolve', () => {
    /** Test : doit marquer un ticket comme resolu */
    it('doit marquer un ticket comme resolu', async () => {
      ticketsService.changeStatus.mockResolvedValue(resolvedResponse as any);

      const result = await controller.resolve(ticketId, {}, mockUser);

      expect(ticketsService.changeStatus).toHaveBeenCalledWith(ticketId, 'RESOLVED', mockUser, undefined);
      expect(result).toEqual(resolvedResponse);
    });

    /** Test : doit utiliser le sub du JWT */

    it('doit utiliser le sub du JWT', async () => {
      ticketsService.changeStatus.mockResolvedValue(resolvedResponse as any);

      await controller.resolve(ticketId, {}, mockUser);

      expect(ticketsService.changeStatus).toHaveBeenCalledWith(ticketId, 'RESOLVED', mockUser, undefined);
    });

    /** Test : doit propager les erreurs du service */

    it('doit propager les erreurs du service', async () => {
      ticketsService.changeStatus.mockRejectedValue(new Error('Transition invalide.'));

      await expect(controller.resolve(ticketId, {}, mockUser)).rejects.toThrow('Transition invalide.');
    });
  });

  // =========================================================================
  // close() — POST /tickets/:id/close
  // =========================================================================
  describe('POST /tickets/:id/close — Close', () => {
    /** Test : doit cloturer un ticket resolu */
    it('doit cloturer un ticket resolu', async () => {
      ticketsService.changeStatus.mockResolvedValue(closedResponse as any);

      const result = await controller.close(ticketId, mockAdmin);

      expect(ticketsService.changeStatus).toHaveBeenCalledWith(ticketId, 'CLOSED', mockAdmin);
      expect(result).toEqual(closedResponse);
    });

    /** Test : doit utiliser le sub du JWT */

    it('doit utiliser le sub du JWT', async () => {
      ticketsService.changeStatus.mockResolvedValue(closedResponse as any);

      await controller.close(ticketId, mockAdmin);

      expect(ticketsService.changeStatus).toHaveBeenCalledWith(ticketId, 'CLOSED', mockAdmin);
    });

    /** Test : doit propager les erreurs du service */

    it('doit propager les erreurs du service', async () => {
      ticketsService.changeStatus.mockRejectedValue(new Error('Impossible de cloturer.'));

      await expect(controller.close(ticketId, mockAdmin)).rejects.toThrow('Impossible de cloturer.');
    });
  });

  // =========================================================================
  // reopen() — POST /tickets/:id/reopen
  // =========================================================================
  describe('POST /tickets/:id/reopen — Reopen', () => {
    /** Test : doit reouvrir un ticket clos */
    it('doit reouvrir un ticket clos', async () => {
      ticketsService.changeStatus.mockResolvedValue(reopenedResponse as any);

      const result = await controller.reopen(ticketId, { reason: 'Raison de reouverture test' }, mockAdmin);

      expect(ticketsService.changeStatus).toHaveBeenCalledWith(
        ticketId,
        'REOPENED',
        mockAdmin,
        'Raison de reouverture test',
      );
      expect(result).toEqual(reopenedResponse);
    });

    /** Test : doit utiliser le sub du JWT */

    it('doit utiliser le sub du JWT', async () => {
      ticketsService.changeStatus.mockResolvedValue(reopenedResponse as any);

      await controller.reopen(ticketId, { reason: 'Raison de reouverture test' }, mockAdmin);

      expect(ticketsService.changeStatus).toHaveBeenCalledWith(
        ticketId,
        'REOPENED',
        mockAdmin,
        'Raison de reouverture test',
      );
    });

    /** Test : doit propager les erreurs du service */

    it('doit propager les erreurs du service', async () => {
      ticketsService.changeStatus.mockRejectedValue(new Error('Impossible de reouvrir.'));

      await expect(controller.reopen(ticketId, { reason: 'Raison de reouverture test' }, mockAdmin)).rejects.toThrow(
        'Impossible de reouvrir.',
      );
    });
  });

  // =========================================================================
  // history() — GET /tickets/:id/history
  // =========================================================================
  describe('GET /tickets/:id/history — History', () => {
    /** Test : doit retourner l historique complet du ticket */
    it('doit retourner l historique complet du ticket', async () => {
      ticketsService.getHistory.mockResolvedValue(historyResponse as any);

      const result = await controller.history(ticketId);

      expect(ticketsService.getHistory).toHaveBeenCalledWith(ticketId);
      expect(result).toEqual(historyResponse);
    });

    /** Test : doit retourner un tableau meme si vide */

    it('doit retourner un tableau meme si vide', async () => {
      ticketsService.getHistory.mockResolvedValue([]);

      const result = await controller.history(ticketId);

      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    /** Test : doit propager TicketNotFoundException */

    it('doit propager TicketNotFoundException', async () => {
      ticketsService.getHistory.mockRejectedValue(new Error('Ticket non trouvé.'));

      await expect(controller.history('id-inexistant')).rejects.toThrow('Ticket non trouvé.');
    });

    /** Test : doit contenir les actions attendues */

    it('doit contenir les actions attendues', async () => {
      ticketsService.getHistory.mockResolvedValue(historyResponse as any);

      const result = await controller.history(ticketId);

      expect(result[0]).toHaveProperty('action', 'TICKET_CREATED');
      expect(result[1]).toHaveProperty('action', 'ASSIGNED');
    });
  });

  // =========================================================================
  // remove() — DELETE /tickets/:id
  // =========================================================================
  describe('DELETE /tickets/:id — Remove (soft delete)', () => {
    /** Test : doit supprimer un ticket (soft delete) */
    it('doit supprimer un ticket (soft delete)', async () => {
      ticketsService.softDelete.mockResolvedValue(undefined);

      const result = await controller.remove(ticketId);

      expect(ticketsService.softDelete).toHaveBeenCalledWith(ticketId);
      expect(result).toBeUndefined();
    });

    /** Test : doit propager les erreurs du service */

    it('doit propager les erreurs du service', async () => {
      ticketsService.softDelete.mockRejectedValue(new Error('Ticket non trouvé.'));

      await expect(controller.remove('id-inexistant')).rejects.toThrow('Ticket non trouvé.');
    });

    /** Test : doit etre tolerant aux doublons (idempotent) */

    it('doit etre tolerant aux doublons (idempotent)', async () => {
      ticketsService.softDelete.mockResolvedValue(undefined);

      await controller.remove(ticketId);
      await controller.remove(ticketId);

      expect(ticketsService.softDelete).toHaveBeenCalledTimes(2);
    });
  });
});
