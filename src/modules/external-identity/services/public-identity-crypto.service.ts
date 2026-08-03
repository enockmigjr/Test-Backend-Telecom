import { Injectable } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { PublicSupportConfigService } from '../../../config/public-support.config';

@Injectable()
export class PublicIdentityCryptoService {
  constructor(private readonly config: PublicSupportConfigService) {}

  contactHash(integrationId: string, identityType: string, normalizedValue: string): string {
    return this.hmac(`contact:${integrationId}:${identityType}:${normalizedValue}`);
  }

  codeHash(challengeId: string, code: string): string {
    return this.hmac(`otp:${challengeId}:${code}`);
  }

  tokenHash(token: string): string {
    return this.opaqueHash('device', token);
  }

  opaqueHash(purpose: string, token: string): string {
    return this.hmac(`${purpose}:${token}`);
  }

  randomOpaqueToken(bytes = 32): string {
    return randomBytes(bytes).toString('base64url');
  }

  matches(expected: string, actual: string): boolean {
    const left = Buffer.from(expected);
    const right = Buffer.from(actual);
    return left.length === right.length && timingSafeEqual(left, right);
  }

  private hmac(value: string): string {
    return createHmac('sha256', this.config.contactHashSecret).update(value).digest('base64url');
  }
}
