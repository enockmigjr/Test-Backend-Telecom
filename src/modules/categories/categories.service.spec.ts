/**
 * ============================================================================
 * FICHIER : src/modules/categories/categories.service.spec.ts
 * RÔLE : Suite de tests unitaires pour le composant categories.service.
 * EXPLICATION :
 * Ce fichier contient les tests automatisés validant le comportement et l'intégrité de categories.service.
 * 1. Vérifie le fonctionnement nominal et les cas d'erreur.
 * 2. Garantit qu'aucune régression n'est introduite lors des évolutions du code.
 * ============================================================================
 */

import { Test } from '@nestjs/testing';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { CategoriesService } from './categories.service';

interface QueryBuilder<T> extends PromiseLike<T[]> {
  from: jest.Mock;
  where: jest.Mock;
  limit: jest.Mock;
}

function queryBuilder<T>(result: T[]): QueryBuilder<T> {
  const builder = Object.assign(Promise.resolve(result), {
    from: jest.fn(),
    where: jest.fn(),
    limit: jest.fn(),
  });
  builder.from.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  return builder;
}

describe('CategoriesService', () => {
  /** Test : persiste targetRole lors de la mise à jour */
  it('persiste targetRole lors de la mise à jour', async () => {
    const category = {
      id: '019f7f6b-6158-788c-ae88-f20169fd43ec',
      name: 'Réseau',
      description: null,
      targetRole: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const select = jest
      .fn()
      .mockReturnValueOnce(queryBuilder([category]))
      .mockReturnValueOnce(queryBuilder([{ ...category, targetRole: 'NOC_ENGINEER' }]));
    const where = jest.fn().mockResolvedValue(undefined);
    const set = jest.fn().mockReturnValue({ where });
    const update = jest.fn().mockReturnValue({ set });
    const module = await Test.createTestingModule({
      providers: [CategoriesService, { provide: DrizzleProvider, useValue: { db: { select, update } } }],
    }).compile();

    const service = module.get(CategoriesService);
    const result = await service.update(category.id, { targetRole: 'NOC_ENGINEER' });

    expect(set).toHaveBeenCalledWith({ targetRole: 'NOC_ENGINEER' });
    expect(result.data.targetRole).toBe('NOC_ENGINEER');
  });
});
