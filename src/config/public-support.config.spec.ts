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

  it('est inactif par défaut et s active avec deepseek + clé', () => {
    const disabled = new PublicSupportConfigService();
    expect(disabled.botEnabled).toBe(false);
    process.env['PUBLIC_SUPPORT_BOT_PROVIDER'] = 'deepseek';
    process.env['PUBLIC_SUPPORT_BOT_API_KEY'] = 'sk-test';
    const deepseek = new PublicSupportConfigService();
    expect(deepseek.botEnabled).toBe(true);
    expect(deepseek.botBaseUrl).toBe('https://api.deepseek.com');
    expect(deepseek.botModel).toBe('deepseek-chat');
  });

  it('utilise les défauts OpenAI-compatibles quand le provider est openai-compatible', () => {
    process.env['PUBLIC_SUPPORT_BOT_PROVIDER'] = 'openai-compatible';
    process.env['PUBLIC_SUPPORT_BOT_API_KEY'] = 'sk-test';
    const config = new PublicSupportConfigService();
    expect(config.botEnabled).toBe(true);
    expect(config.botBaseUrl).toBe('https://api.openai.com/v1');
    expect(config.botModel).toBe('gpt-4o-mini');
  });
});
