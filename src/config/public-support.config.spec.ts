import { PublicSupportConfigService } from './public-support.config';

describe('PublicSupportConfigService', () => {
  const snapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...snapshot };
  });

  it('charge un trousseau AES-256 versionné', () => {
    process.env['PUBLIC_SUPPORT_MASTER_KEYS'] = `1:${Buffer.alloc(32, 7).toString('base64')}`;
    process.env['PUBLIC_SUPPORT_MASTER_KEY_VERSION'] = '1';
    const config = new PublicSupportConfigService();
    expect(config.masterKeys.get(1)).toHaveLength(32);
  });

  it('refuse une clé invalide ou une version courante absente', () => {
    process.env['PUBLIC_SUPPORT_MASTER_KEYS'] = '1:aW52YWxpZA==';
    expect(() => new PublicSupportConfigService().masterKeys).toThrow('AES-256');
    process.env['PUBLIC_SUPPORT_MASTER_KEYS'] = `1:${Buffer.alloc(32, 7).toString('base64')}`;
    process.env['PUBLIC_SUPPORT_MASTER_KEY_VERSION'] = '2';
    expect(() => new PublicSupportConfigService().masterKeys).toThrow('courante');
  });

  it('refuse de réutiliser le secret JWT interne', () => {
    process.env['JWT_ACCESS_SECRET'] = 'a'.repeat(32);
    process.env['PUBLIC_SESSION_SECRET'] = 'a'.repeat(32);
    expect(() => new PublicSupportConfigService().publicSessionSecret).toThrow('distinct');
  });
});
