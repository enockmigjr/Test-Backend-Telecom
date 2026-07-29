/**
 * ============================================================================
 * FICHIER : src/modules/departments/departments.controller.spec.ts
 * RÔLE : Suite de tests unitaires pour le composant departments.controller.
 * EXPLICATION :
 * Ce fichier contient les tests automatisés validant le comportement et l'intégrité de departments.controller.
 * 1. Vérifie le fonctionnement nominal et les cas d'erreur.
 * 2. Garantit qu'aucune régression n'est introduite lors des évolutions du code.
 * ============================================================================
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { mock, MockProxy } from 'jest-mock-extended';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const now = new Date('2026-01-01T00:00:00Z');

const departmentsList = [
  {
    id: 'dept-001',
    name: 'Customer Care',
    description: 'Support client',
    autoAssignmentEnabled: true,
    assignmentStrategy: 'LEAST_LOADED',
    maxWorkloadPerAgent: 100,
    workloadWeights: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  },
  {
    id: 'dept-002',
    name: 'NOC',
    description: 'Network Operations Center',
    autoAssignmentEnabled: true,
    assignmentStrategy: 'LEAST_LOADED',
    maxWorkloadPerAgent: 100,
    workloadWeights: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  },
  {
    id: 'dept-003',
    name: 'Support Technique',
    description: null,
    autoAssignmentEnabled: true,
    assignmentStrategy: 'LEAST_LOADED',
    maxWorkloadPerAgent: 100,
    workloadWeights: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  },
];

const singleDepartment = {
  id: 'dept-001',
  name: 'Customer Care',
  description: 'Support client',
  autoAssignmentEnabled: true,
  assignmentStrategy: 'LEAST_LOADED',
  maxWorkloadPerAgent: 100,
  workloadWeights: null,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
};

const createResult = {
  message: 'Département créé avec succès.',
  data: {
    id: 'dept-004',
    name: 'Billing',
    description: 'Service facturation',
    autoAssignmentEnabled: true,
    assignmentStrategy: 'LEAST_LOADED',
    maxWorkloadPerAgent: 100,
    workloadWeights: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  },
};

const updateResult = {
  message: 'Département mis à jour avec succès.',
  data: {
    id: 'dept-001',
    name: 'Customer Care Updated',
    description: 'Description mise à jour',
    autoAssignmentEnabled: true,
    assignmentStrategy: 'LEAST_LOADED',
    maxWorkloadPerAgent: 100,
    workloadWeights: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  },
};

const createdto: CreateDepartmentDto = { name: 'Billing', description: 'Service facturation' };
const updatedto: UpdateDepartmentDto = { name: 'Customer Care Updated', description: 'Description mise à jour' };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('DepartmentsController', () => {
  let controller: DepartmentsController;
  let departmentsService: MockProxy<DepartmentsService>;

  beforeEach(async () => {
    departmentsService = mock<DepartmentsService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DepartmentsController],
      providers: [{ provide: DepartmentsService, useValue: departmentsService }],
    }).compile();

    controller = module.get<DepartmentsController>(DepartmentsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // findAll()
  // =========================================================================
  describe('GET /departments (public)', () => {
    /** Test : doit retourner la liste de tous les départements */
    it('doit retourner la liste de tous les départements', async () => {
      departmentsService.findAll.mockResolvedValue(departmentsList);

      const result = await controller.findAll();

      expect(departmentsService.findAll).toHaveBeenCalledTimes(1);
      expect(result).toEqual(departmentsList);
      expect(result).toHaveLength(3);
    });

    /** Test : doit retourner un tableau vide si aucun département */

    it('doit retourner un tableau vide si aucun département', async () => {
      departmentsService.findAll.mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
    });

    /** Test : doit propager les erreurs du service */

    it('doit propager les erreurs du service', async () => {
      departmentsService.findAll.mockRejectedValue(new Error('Erreur base de données'));

      await expect(controller.findAll()).rejects.toThrow('Erreur base de données');
    });
  });

  // =========================================================================
  // findOne()
  // =========================================================================
  describe('GET /departments/:id', () => {
    /** Test : doit retourner un département par son ID */
    it('doit retourner un département par son ID', async () => {
      departmentsService.findOne.mockResolvedValue(singleDepartment);

      const result = await controller.findOne('dept-001');

      expect(departmentsService.findOne).toHaveBeenCalledWith('dept-001');
      expect(result).toEqual(singleDepartment);
      expect(result.name).toBe('Customer Care');
    });

    it("doit propager NotFoundException si le département n'existe pas", async () => {
      departmentsService.findOne.mockRejectedValue(new Error('Département non trouvé.'));

      await expect(controller.findOne('dept-inexistant')).rejects.toThrow('Département non trouvé.');
    });
  });

  // =========================================================================
  // create()
  // =========================================================================
  describe('POST /departments (Admin uniquement)', () => {
    /** Test : doit créer un département et retourner 201 */
    it('doit créer un département et retourner 201', async () => {
      departmentsService.create.mockResolvedValue(createResult);

      const result = await controller.create(createdto);

      expect(departmentsService.create).toHaveBeenCalledWith(createdto);
      expect(result).toEqual(createResult);
      expect(result.data.name).toBe('Billing');
    });

    /** Test : doit propager ConflictException si le nom existe déjà */

    it('doit propager ConflictException si le nom existe déjà', async () => {
      departmentsService.create.mockRejectedValue(new Error('Un département avec ce nom existe déjà.'));

      await expect(controller.create(createdto)).rejects.toThrow('Un département avec ce nom existe déjà.');
    });
  });

  // =========================================================================
  // update()
  // =========================================================================
  describe('PATCH /departments/:id (Admin uniquement)', () => {
    /** Test : doit mettre à jour un département */
    it('doit mettre à jour un département', async () => {
      departmentsService.update.mockResolvedValue(updateResult);

      const result = await controller.update('dept-001', updatedto);

      expect(departmentsService.update).toHaveBeenCalledWith('dept-001', updatedto);
      expect(result).toEqual(updateResult);
      expect(result.data.name).toBe('Customer Care Updated');
    });

    it("doit propager NotFoundException si le département n'existe pas", async () => {
      departmentsService.update.mockRejectedValue(new Error('Département non trouvé.'));

      await expect(controller.update('dept-inexistant', updatedto)).rejects.toThrow('Département non trouvé.');
    });
  });

  // =========================================================================
  // remove()
  // =========================================================================
  describe('DELETE /departments/:id (Admin uniquement)', () => {
    /** Test : doit supprimer un département et retourner 204 */
    it('doit supprimer un département et retourner 204', async () => {
      departmentsService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('dept-001');

      expect(departmentsService.remove).toHaveBeenCalledWith('dept-001');
      expect(result).toBeUndefined();
    });

    it("doit propager NotFoundException si le département n'existe pas", async () => {
      departmentsService.remove.mockRejectedValue(new Error('Département non trouvé.'));

      await expect(controller.remove('dept-inexistant')).rejects.toThrow('Département non trouvé.');
    });

    /** Test : doit propager ConflictException si des utilisateurs sont liés */

    it('doit propager ConflictException si des utilisateurs sont liés', async () => {
      departmentsService.remove.mockRejectedValue(
        new Error('Impossible de supprimer : des utilisateurs sont liés à ce département.'),
      );

      await expect(controller.remove('dept-001')).rejects.toThrow('des utilisateurs sont liés');
    });

    /** Test : doit propager ConflictException si des tickets sont liés */

    it('doit propager ConflictException si des tickets sont liés', async () => {
      departmentsService.remove.mockRejectedValue(
        new Error('Impossible de supprimer : des tickets sont liés à ce département.'),
      );

      await expect(controller.remove('dept-001')).rejects.toThrow('des tickets sont liés');
    });
  });
});
