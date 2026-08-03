import { SetMetadata } from '@nestjs/common';

export enum AuthMode {
  ANONYMOUS = 'ANONYMOUS',
  INTERNAL = 'INTERNAL',
  PUBLIC_SESSION = 'PUBLIC_SESSION',
  INTEGRATION_ASSERTION = 'INTEGRATION_ASSERTION',
}

export const AUTH_MODE_KEY = 'authMode';

/** Rend le mode d'authentification d'une route explicite et auditable. */
export const Auth = (mode: AuthMode) => SetMetadata(AUTH_MODE_KEY, mode);
