import { JwtConfigService } from './jwt.config';

describe('JwtConfigService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'test' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('convertit les expirations configurees en secondes', () => {
    process.env['JWT_ACCESS_EXPIRATION'] = '20m';
    process.env['JWT_REFRESH_EXPIRATION'] = '2d';
    const config = new JwtConfigService();
    expect(config.accessExpirationSeconds).toBe(1200);
    expect(config.refreshExpirationSeconds).toBe(172800);
  });

  it('interdit le secret de developpement implicite en production', () => {
    process.env['NODE_ENV'] = 'production';
    delete process.env['JWT_ACCESS_SECRET'];
    expect(() => new JwtConfigService().accessSecret).toThrow('JWT_ACCESS_SECRET');
  });

  it('interdit la valeur exemple en production', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['JWT_ACCESS_SECRET'] = 'change-me-access-secret-min-32-chars';
    expect(() => new JwtConfigService().accessSecret).toThrow('JWT_ACCESS_SECRET');
  });
});
