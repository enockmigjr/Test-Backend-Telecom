import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';

export const IDEMPOTENT_KEY = 'idempotent';

/**
 * Décorateur pour marquer une route comme idempotente.
 * L'intercepteur global vérifie le header `Idempotency-Key`
 * pour éviter les requêtes en double.
 *
 * Usage:
 *   @Idempotent()
 *   @Post('tickets')
 *   async create(...) { }
 */
export const Idempotent = () =>
  applyDecorators(
    SetMetadata(IDEMPOTENT_KEY, true),
    ApiHeader({
      name: 'Idempotency-Key',
      required: false,
      description: 'Clé unique de 1 à 128 caractères pour rejouer une mutation sans la dupliquer.',
    }),
  );
