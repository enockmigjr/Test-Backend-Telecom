import { Injectable } from '@nestjs/common';

@Injectable()
export class PublicSupportConfigService {
  get currentMasterKeyVersion(): number {
    return positiveInteger('PUBLIC_SUPPORT_MASTER_KEY_VERSION', 1);
  }

  get masterKeys(): ReadonlyMap<number, Buffer> {
    const raw = process.env['PUBLIC_SUPPORT_MASTER_KEYS'];
    if (!raw) throw new Error('PUBLIC_SUPPORT_MASTER_KEYS est obligatoire.');
    const keys = new Map<number, Buffer>();
    for (const item of raw.split(',')) {
      const separator = item.indexOf(':');
      const version = Number(item.slice(0, separator));
      const key = Buffer.from(item.slice(separator + 1), 'base64');
      if (!Number.isSafeInteger(version) || version < 1 || key.length !== 32) {
        throw new Error('PUBLIC_SUPPORT_MASTER_KEYS doit contenir des clés AES-256 versionnées.');
      }
      keys.set(version, key);
    }
    if (!keys.has(this.currentMasterKeyVersion)) throw new Error('Clé maîtresse courante introuvable.');
    return keys;
  }

  get secretRotationGraceMinutes(): number {
    return boundedInteger('PUBLIC_SUPPORT_SECRET_GRACE_MINUTES', 15, 1, 1440);
  }

  get trustedDeviceDays(): number {
    return boundedInteger('PUBLIC_SUPPORT_DEVICE_TRUST_DAYS', 90, 1, 365);
  }

  get trustedDevicePolicyVersion(): number {
    return positiveInteger('PUBLIC_SUPPORT_DEVICE_POLICY_VERSION', 1);
  }

  get otpTtlSeconds(): number {
    return boundedInteger('PUBLIC_SUPPORT_OTP_TTL_SECONDS', 600, 120, 1800);
  }

  get otpMaxAttempts(): number {
    return boundedInteger('PUBLIC_SUPPORT_OTP_MAX_ATTEMPTS', 5, 3, 10);
  }

  get otpResendSeconds(): number {
    return boundedInteger('PUBLIC_SUPPORT_OTP_RESEND_SECONDS', 60, 30, 600);
  }

  get publicSessionTtlSeconds(): number {
    return boundedInteger('PUBLIC_SESSION_TTL_SECONDS', 900, 300, 3600);
  }

  get contactHashSecret(): string {
    return requiredSecret('PUBLIC_SUPPORT_CONTACT_HASH_SECRET');
  }

  get publicSessionSecret(): string {
    const secret = requiredSecret('PUBLIC_SESSION_SECRET');
    if (secret === process.env['JWT_ACCESS_SECRET'])
      throw new Error('Le secret public doit être distinct du JWT interne.');
    return secret;
  }

  get publicSessionIssuer(): string {
    return process.env['PUBLIC_SESSION_ISSUER'] || 'telecom-public-support';
  }

  get publicSessionAudience(): string {
    return process.env['PUBLIC_SESSION_AUDIENCE'] || 'telecom-public-bff';
  }

  get integrationAssertionAudience(): string {
    return process.env['PUBLIC_ASSERTION_AUDIENCE'] || 'telecom-integration-assertion';
  }

  get integrationAssertionMaxAgeSeconds(): number {
    return boundedInteger('PUBLIC_ASSERTION_MAX_AGE_SECONDS', 120, 30, 300);
  }

  get bootstrapTtlSeconds(): number {
    return boundedInteger('PUBLIC_BOOTSTRAP_TTL_SECONDS', 120, 30, 300);
  }

  get botMaxTokens(): number {
    return boundedInteger('PUBLIC_SUPPORT_BOT_MAX_TOKENS', 800, 100, 4000);
  }

  get botTimeoutMs(): number {
    return boundedInteger('PUBLIC_SUPPORT_BOT_TIMEOUT_MS', 20000, 2000, 60000);
  }

  get botPromptVersion(): string {
    return process.env['PUBLIC_SUPPORT_BOT_PROMPT_VERSION'] || '2026-08-v1';
  }

  get botProvider(): string {
    return (process.env['PUBLIC_SUPPORT_BOT_PROVIDER'] || 'none').toLowerCase();
  }

  get botApiKey(): string | undefined {
    const value = process.env['PUBLIC_SUPPORT_BOT_API_KEY'];
    return value && value.length > 0 ? value : undefined;
  }

  get botBaseUrl(): string {
    return process.env['PUBLIC_SUPPORT_BOT_BASE_URL'] || 'https://api.openai.com/v1';
  }

  get botModel(): string {
    return process.env['PUBLIC_SUPPORT_BOT_MODEL'] || 'gpt-4o-mini';
  }

  get botEnabled(): boolean {
    return this.botProvider === 'openai-compatible' && Boolean(this.botApiKey);
  }

  get botDailyBudget(): number {
    return boundedInteger('PUBLIC_SUPPORT_BOT_DAILY_BUDGET', 200, 1, 100_000);
  }

  get botCircuitOpenAfter(): number {
    return boundedInteger('PUBLIC_SUPPORT_BOT_CIRCUIT_OPEN_AFTER', 5, 2, 100);
  }

  get botCircuitOpenMs(): number {
    return boundedInteger('PUBLIC_SUPPORT_BOT_CIRCUIT_OPEN_MS', 600_000, 10_000, 3_600_000);
  }
}

function requiredSecret(name: string): string {
  const value = process.env[name];
  if (!value || value.length < 32) throw new Error(`${name} doit contenir au moins 32 caractères.`);
  return value;
}

function positiveInteger(name: string, fallback: number): number {
  return boundedInteger(name, fallback, 1, Number.MAX_SAFE_INTEGER);
}

function boundedInteger(name: string, fallback: number, minimum: number, maximum: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} doit être un entier entre ${minimum} et ${maximum}.`);
  }
  return value;
}
