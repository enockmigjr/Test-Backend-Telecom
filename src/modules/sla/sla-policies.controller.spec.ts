/**
 * ============================================================================
 * FICHIER : src/modules/sla/sla-policies.controller.spec.ts
 * RÔLE : Suite de tests unitaires pour le composant sla-policies.controller.
 * EXPLICATION :
 * Ce fichier contient les tests automatisés validant le comportement et l'intégrité de sla-policies.controller.
 * 1. Vérifie le fonctionnement nominal et les cas d'erreur.
 * 2. Garantit qu'aucune régression n'est introduite lors des évolutions du code.
 * ============================================================================
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { SlaPoliciesController } from './sla-policies.controller';
import { SlaPoliciesService } from './sla-policies.service';
import { CreateSlaPolicyDto, UpdateSlaPolicyDto } from './dto/sla-policy.dto';
import { mock, MockProxy } from 'jest-mock-extended';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const now = new Date('2026-01-01T00:00:00Z');

const slaPoliciesList = [
  {
    id: 'sla-001',
    categoryId: '019f28ea-9e12-7cc0-a0ea-3d4de79e7a95',
    categoryName: 'NETWORK',
    priority: 'CRITICAL' as const,
    firstResponseMinutes: 15,
    resolutionMinutes: 120,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'sla-002',
    categoryId: '019f28ea-9e12-7cc0-a0ea-3d4de79e7a95',
    categoryName: 'NETWORK',
    priority: 'HIGH' as const,
    firstResponseMinutes: 30,
    resolutionMinutes: 240,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'sla-003',
    categoryId: '019f28ea-9e12-7cc0-a0ea-3d4de79e7a96',
    categoryName: 'BILLING',
    priority: 'MEDIUM' as const,
    firstResponseMinutes: 60,
    resolutionMinutes: 1440,
    createdAt: now,
    updatedAt: now,
  },
];

const singlePolicy = {
  id: 'sla-001',
  categoryId: '019f28ea-9e12-7cc0-a0ea-3d4de79e7a95',
  categoryName: 'NETWORK',
  priority: 'CRITICAL' as const,
  firstResponseMinutes: 15,
  resolutionMinutes: 120,
  createdAt: now,
  updatedAt: now,
};

const createResult = {
  message: 'Politique SLA créée.',
  data: {
    id: 'sla-004',
    categoryId: '019f28ea-9e12-7cc0-a0ea-3d4de79e7a97',
    categoryName: 'TECHNICAL',
    priority: 'HIGH' as const,
    firstResponseMinutes: 30,
    resolutionMinutes: 480,
    createdAt: now,
    updatedAt: now,
  },
};

const updateResult = {
  message: 'Politique SLA mise à jour.',
  data: {
    id: 'sla-001',
    categoryId: '019f28ea-9e12-7cc0-a0ea-3d4de79e7a95',
    categoryName: 'NETWORK',
    priority: 'CRITICAL' as const,
    firstResponseMinutes: 10,
    resolutionMinutes: 90,
    createdAt: now,
    updatedAt: now,
  },
};

const createDto: CreateSlaPolicyDto = {
  categoryId: '019f28ea-9e12-7cc0-a0ea-3d4de79e7a97',
  priority: 'HIGH',
  firstResponseMinutes: 30,
  resolutionMinutes: 480,
};

const updateDto: UpdateSlaPolicyDto = {
  firstResponseMinutes: 10,
  resolutionMinutes: 90,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('SlaPoliciesController', () => {
  let controller: SlaPoliciesController;
  let slaPoliciesService: MockProxy<SlaPoliciesService>;

  beforeEach(async () => {
    slaPoliciesService = mock<SlaPoliciesService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SlaPoliciesController],
      providers: [{ provide: SlaPoliciesService, useValue: slaPoliciesService }],
    }).compile();

    controller = module.get<SlaPoliciesController>(SlaPoliciesController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // findAll()
  // =========================================================================
  describe('GET /sla-policies', () => {
    /** Test : doit retourner la liste de toutes les politiques SLA */
    it('doit retourner la liste de toutes les politiques SLA', async () => {
      slaPoliciesService.findAll.mockResolvedValue(slaPoliciesList);

      const result = await controller.findAll();

      expect(slaPoliciesService.findAll).toHaveBeenCalledTimes(1);
      expect(result).toEqual(slaPoliciesList);
      expect(result).toHaveLength(3);
    });

    /** Test : doit retourner un tableau vide si aucune politique */

    it('doit retourner un tableau vide si aucune politique', async () => {
      slaPoliciesService.findAll.mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
    });

    /** Test : doit propager les erreurs du service */

    it('doit propager les erreurs du service', async () => {
      slaPoliciesService.findAll.mockRejectedValue(new Error('Erreur base de données'));

      await expect(controller.findAll()).rejects.toThrow('Erreur base de données');
    });
  });

  // =========================================================================
  // findOne()
  // =========================================================================
  describe('GET /sla-policies/:id', () => {
    /** Test : doit retourner une politique SLA par son ID */
    it('doit retourner une politique SLA par son ID', async () => {
      slaPoliciesService.findOne.mockResolvedValue(singlePolicy);

      const result = await controller.findOne('sla-001');

      expect(slaPoliciesService.findOne).toHaveBeenCalledWith('sla-001');
      expect(result).toEqual(singlePolicy);
      expect(result.categoryName).toBe('NETWORK');
      expect(result.priority).toBe('CRITICAL');
    });

    it("doit propager NotFoundException si la politique n'existe pas", async () => {
      slaPoliciesService.findOne.mockRejectedValue(new Error('Politique SLA non trouvée.'));

      await expect(controller.findOne('sla-inexistant')).rejects.toThrow('Politique SLA non trouvée.');
    });
  });

  // =========================================================================
  // create()
  // =========================================================================
  describe('POST /sla-policies (Admin uniquement)', () => {
    /** Test : reserve explicitement la creation a ADMINISTRATOR */
    it('reserve explicitement la creation a ADMINISTRATOR', () => {
      expect(Reflect.getMetadata(ROLES_KEY, controller.create)).toEqual(['ADMINISTRATOR']);
    });

    /** Test : doit créer une politique SLA et retourner 201 */

    it('doit créer une politique SLA et retourner 201', async () => {
      slaPoliciesService.create.mockResolvedValue(createResult);

      const result = await controller.create(createDto);

      expect(slaPoliciesService.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(createResult);
    });

    /** Test : doit propager ConflictException si la combinaison catégorie/priorité existe */

    it('doit propager ConflictException si la combinaison catégorie/priorité existe', async () => {
      slaPoliciesService.create.mockRejectedValue(
        new Error('Une politique SLA existe déjà pour cette combinaison catégorie/priorité.'),
      );

      await expect(controller.create(createDto)).rejects.toThrow(
        'Une politique SLA existe déjà pour cette combinaison catégorie/priorité.',
      );
    });
  });

  // =========================================================================
  // update()
  // =========================================================================
  describe('PATCH /sla-policies/:id (Admin uniquement)', () => {
    /** Test : reserve explicitement la modification a ADMINISTRATOR */
    it('reserve explicitement la modification a ADMINISTRATOR', () => {
      expect(Reflect.getMetadata(ROLES_KEY, controller.update)).toEqual(['ADMINISTRATOR']);
    });

    it("doit mettre à jour les délais d'une politique SLA", async () => {
      slaPoliciesService.update.mockResolvedValue(updateResult);

      const result = await controller.update('sla-001', updateDto);

      expect(slaPoliciesService.update).toHaveBeenCalledWith('sla-001', updateDto);
      expect(result).toEqual(updateResult);
    });

    /** Test : doit mettre à jour uniquement firstResponseMinutes */

    it('doit mettre à jour uniquement firstResponseMinutes', async () => {
      slaPoliciesService.update.mockResolvedValue(updateResult);
      const partialUpdate: UpdateSlaPolicyDto = { firstResponseMinutes: 20 };

      await controller.update('sla-001', partialUpdate);

      expect(slaPoliciesService.update).toHaveBeenCalledWith('sla-001', partialUpdate);
    });

    /** Test : doit mettre à jour uniquement resolutionMinutes */

    it('doit mettre à jour uniquement resolutionMinutes', async () => {
      slaPoliciesService.update.mockResolvedValue(updateResult);
      const partialUpdate: UpdateSlaPolicyDto = { resolutionMinutes: 300 };

      await controller.update('sla-001', partialUpdate);

      expect(slaPoliciesService.update).toHaveBeenCalledWith('sla-001', partialUpdate);
    });

    it("doit propager NotFoundException si la politique n'existe pas", async () => {
      slaPoliciesService.update.mockRejectedValue(new Error('Politique SLA non trouvée.'));

      await expect(controller.update('sla-inexistant', updateDto)).rejects.toThrow('Politique SLA non trouvée.');
    });
  });
});
