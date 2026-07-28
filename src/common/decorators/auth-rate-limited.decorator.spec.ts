import { AUTH_RATE_LIMITED_KEY, isAuthRateLimited } from './auth-rate-limited.decorator';

describe('isAuthRateLimited', () => {
  it('ne cible que les handlers explicitement marqués', () => {
    const login = () => undefined;
    const profile = () => undefined;
    Reflect.defineMetadata(AUTH_RATE_LIMITED_KEY, true, login);

    expect(isAuthRateLimited(login)).toBe(true);
    expect(isAuthRateLimited(profile)).toBe(false);
  });
});
