import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { supportIntegrations } from '../../../database/schemas';

const FEATURE_KEYS: Readonly<Record<string, string>> = {
  publicAttachments: 'attachments',
  publicRealtime: 'realtime',
  publicBot: 'bot',
};

@Injectable()
export class PublicIntegrationConfigService {
  constructor(private readonly drizzle: DrizzleProvider) {}

  async get(integrationKey: string, origin?: string) {
    const [integration] = await this.drizzle.db
      .select({
        name: supportIntegrations.name,
        allowedOrigins: supportIntegrations.allowedOrigins,
        appearance: supportIntegrations.appearance,
        features: supportIntegrations.features,
      })
      .from(supportIntegrations)
      .where(and(eq(supportIntegrations.publicKey, integrationKey), eq(supportIntegrations.status, 'ACTIVE')))
      .limit(1);
    if (!integration) throw new NotFoundException('Intégration de support indisponible.');
    return {
      data: {
        name: integration.name,
        frameAllowed: origin ? integration.allowedOrigins.includes(origin) : false,
        appearance: sanitizeAppearance(integration.appearance),
        features: Object.fromEntries(
          Object.entries(FEATURE_KEYS).map(([publicKey, dbKey]) => [publicKey, integration.features[dbKey] === true]),
        ),
      },
    };
  }
}

function sanitizeAppearance(value: Record<string, unknown>) {
  return {
    supportName: boundedText(value['supportName'], 80),
    welcomeTitle: boundedText(value['welcomeTitle'], 120),
    welcomeMessage: boundedText(value['welcomeMessage'], 500),
    primaryColor: safeColor(value['primaryColor']),
    accentColor: safeColor(value['accentColor']),
    logoUrl: safeHttpsUrl(value['logoUrl']),
  };
}

function boundedText(value: unknown, maximum: number): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maximum ? value.trim() : undefined;
}

function safeColor(value: unknown): string | undefined {
  return typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value) ? value.toUpperCase() : undefined;
}

function safeHttpsUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
