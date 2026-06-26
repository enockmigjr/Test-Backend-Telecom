import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Décorateur pour marquer une route comme publique (sans authentification).
 * Usage : @Public()
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
