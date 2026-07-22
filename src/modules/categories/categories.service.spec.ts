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
