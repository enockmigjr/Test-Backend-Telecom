import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Décorateur pour restreindre l'accès à certains rôles.
 * Usage : @Roles('ADMINISTRATOR', 'SUPERVISOR')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
