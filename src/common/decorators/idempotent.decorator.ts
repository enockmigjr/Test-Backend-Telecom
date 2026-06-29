import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_KEY = 'idempotent';

/**
 * Décorateur pour marquer une route comme idempotente.
 * Le middleware IdempotencyMiddleware vérifie le header `Idempotency-Key`
 * pour éviter les requêtes en double.
 *
 * Usage:
 *   @Idempotent()
 *   @Post('tickets')
 *   async create(...) { }
 */
export const Idempotent = () => SetMetadata(IDEMPOTENT_KEY, true);
