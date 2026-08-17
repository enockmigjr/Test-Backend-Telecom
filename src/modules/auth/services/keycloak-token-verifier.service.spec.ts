import { UnauthorizedException } from '@nestjs/common';
import { generateKeyPairSync } from 'node:crypto';
import * as jwt from 'jsonwebtoken';

import { KeycloakJwksService } from './keycloak-jwks.service';
import { KeycloakTokenVerifierService } from './keycloak-token-verifier.service';

const keyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicKeyPem = keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();

function sign(payload: object, options: jwt.SignOptions): string {
  return jwt.sign(payload, keyPair.privateKey, { algorithm: 'RS256', ...options });
}

function jwksMock() {
  return { publicKey: jest.fn().mockResolvedValue(publicKeyPem) } as unknown as KeycloakJwksService;
}

describe('KeycloakTokenVerifierService', () => {
  it('vérifie un jeton RS256 signé par la clé du realm', async () => {
    const service = new KeycloakTokenVerifierService(jwksMock());
    const token = sign({ sub: 'subject-1', jti: 'jti-1' }, { keyid: 'kid-1' });

    await expect(service.verify<{ sub: string }>(token)).resolves.toMatchObject({ sub: 'subject-1' });
  });

  it('refuse un jeton HS256 (anti alg-confusion)', async () => {
    const service = new KeycloakTokenVerifierService(jwksMock());
    const token = jwt.sign({ sub: 'subject-1' }, 'shared-secret', { algorithm: 'HS256' });

    await expect(service.verify(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuse un jeton dont la signature a été altérée', async () => {
    const service = new KeycloakTokenVerifierService(jwksMock());
    const token = sign({ sub: 'subject-1' }, { keyid: 'kid-1' });

    await expect(service.verify(`${token.slice(0, -4)}xxxx`)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuse un jeton sans kid résolvable', async () => {
    const keycloakJwks = {
      publicKey: jest.fn().mockRejectedValue(new UnauthorizedException()),
    } as unknown as KeycloakJwksService;
    const service = new KeycloakTokenVerifierService(keycloakJwks);
    const token = sign({ sub: 'subject-1' }, { keyid: 'unknown-kid' });

    await expect(service.verify(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
