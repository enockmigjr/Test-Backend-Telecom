import { TransformInterceptor } from './transform.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

/**
 * Tests du TransformInterceptor — vérifie le wrapping standardisé des réponses.
 */
describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<unknown>;

  beforeEach(() => {
    interceptor = new TransformInterceptor<unknown>();
  });

  function mockContext(statusCode: number): ExecutionContext {
    return {
      switchToHttp: () => ({ getResponse: () => ({ statusCode }) }),
    } as unknown as ExecutionContext;
  }

  function mockCallHandler(data: unknown): CallHandler {
    return { handle: () => of(data) } as CallHandler;
  }

  it('doit wrapper une réponse simple dans { success: true, data }', async () => {
    const result = await interceptor.intercept(mockContext(200), mockCallHandler({ id: '1' })).toPromise();
    expect(result).toEqual({ success: true, statusCode: 200, data: { id: '1' } });
  });

  it('doit wrapper un tableau dans { success: true, data }', async () => {
    const result = await interceptor
      .intercept(mockContext(200), mockCallHandler([{ id: '1' }, { id: '2' }]))
      .toPromise();
    expect(result).toEqual({ success: true, statusCode: 200, data: [{ id: '1' }, { id: '2' }] });
  });

  it('ne doit pas re-wrapper une réponse déjà au format standard', async () => {
    const alreadyWrapped = { success: true, data: { id: '1' } };
    const result = await interceptor.intercept(mockContext(200), mockCallHandler(alreadyWrapped)).toPromise();
    expect(result).toEqual(alreadyWrapped);
  });

  it('doit préserver le message si présent dans la réponse', async () => {
    const withMessage = { message: 'OK', data: { id: '1' } };
    const result = await interceptor.intercept(mockContext(201), mockCallHandler(withMessage)).toPromise();
    expect(result).toEqual({ success: true, statusCode: 201, message: 'OK', data: { id: '1' } });
  });

  it('doit préserver la pagination au niveau racine', async () => {
    const paginated = { data: [{ id: '1' }], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } };
    const result = await interceptor.intercept(mockContext(200), mockCallHandler(paginated)).toPromise();
    expect(result).toEqual({ success: true, statusCode: 200, ...paginated });
  });

  it('doit éviter une double enveloppe pour un détail déjà sous data', async () => {
    const detailed = { data: { id: '1', assignmentHistory: { data: [], meta: { total: 0 } } } };
    const result = await interceptor.intercept(mockContext(200), mockCallHandler(detailed)).toPromise();
    expect(result).toEqual({ success: true, statusCode: 200, ...detailed });
  });

  it('doit préserver un message sans créer de data imbriqué', async () => {
    const result = await interceptor.intercept(mockContext(200), mockCallHandler({ message: 'Terminé' })).toPromise();
    expect(result).toEqual({ success: true, statusCode: 200, message: 'Terminé' });
  });

  it('doit gérer une réponse null', async () => {
    const result = await interceptor.intercept(mockContext(204), mockCallHandler(null)).toPromise();
    expect(result).toEqual({ success: true, statusCode: 204, data: null });
  });

  it('doit gérer une réponse string', async () => {
    const result = await interceptor.intercept(mockContext(200), mockCallHandler('hello')).toPromise();
    expect(result).toEqual({ success: true, statusCode: 200, data: 'hello' });
  });
});
