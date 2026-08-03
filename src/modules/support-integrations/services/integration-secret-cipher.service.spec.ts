import { PublicSupportConfigService } from '../../../config/public-support.config';
import { IntegrationSecretCipherService } from './integration-secret-cipher.service';

describe('IntegrationSecretCipherService', () => {
  const previousKeys = process.env['PUBLIC_SUPPORT_MASTER_KEYS'];
  const previousVersion = process.env['PUBLIC_SUPPORT_MASTER_KEY_VERSION'];

  beforeEach(() => {
    process.env['PUBLIC_SUPPORT_MASTER_KEYS'] =
      `1:${Buffer.alloc(32, 1).toString('base64')},2:${Buffer.alloc(32, 2).toString('base64')}`;
    process.env['PUBLIC_SUPPORT_MASTER_KEY_VERSION'] = '2';
  });

  afterAll(() => {
    restore('PUBLIC_SUPPORT_MASTER_KEYS', previousKeys);
    restore('PUBLIC_SUPPORT_MASTER_KEY_VERSION', previousVersion);
  });

  it('chiffre avec la version courante et déchiffre avec le même contexte', () => {
    const cipher = new IntegrationSecretCipherService(new PublicSupportConfigService());
    const sealed = cipher.seal('secret-wordpress-long-et-confidentiel', 'integration:1');
    expect(sealed.keyVersion).toBe(2);
    expect(sealed.encryptedSecret).not.toContain('secret-wordpress');
    expect(cipher.open(sealed.encryptedSecret, sealed.keyVersion, 'integration:1')).toBe(
      'secret-wordpress-long-et-confidentiel',
    );
  });

  it('refuse un contexte différent ou un chiffré altéré', () => {
    const cipher = new IntegrationSecretCipherService(new PublicSupportConfigService());
    const sealed = cipher.seal('secret-wordpress-long-et-confidentiel', 'integration:1');
    expect(() => cipher.open(sealed.encryptedSecret, sealed.keyVersion, 'integration:2')).toThrow();
    expect(() => cipher.open(`${sealed.encryptedSecret}x`, sealed.keyVersion, 'integration:1')).toThrow();
  });
});

function restore(name: string, value?: string): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
