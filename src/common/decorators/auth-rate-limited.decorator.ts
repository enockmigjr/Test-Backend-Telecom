import { SetMetadata } from '@nestjs/common';

export const AUTH_RATE_LIMITED_KEY = 'auth-rate-limited';

export const AuthRateLimited = () => SetMetadata(AUTH_RATE_LIMITED_KEY, true);

export function isAuthRateLimited(handler: object): boolean {
  return Reflect.getMetadata(AUTH_RATE_LIMITED_KEY, handler) === true;
}
