import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PublicPrincipal } from '../modules/external-identity/interfaces/public-principal.interface';
import { PublicSessionService } from '../modules/external-identity/services/public-session.service';
import { DrizzleProvider } from '../database/drizzle.provider';
import { supportIntegrations } from '../database/schemas';
import { eq } from 'drizzle-orm';

@Injectable()
export class PublicWebSocketAuthService {
  constructor(
    private readonly sessions: PublicSessionService,
    private readonly drizzle: DrizzleProvider,
  ) {}

  async authenticate(cookieHeader: string | undefined, origin: string | undefined): Promise<PublicPrincipal> {
    const token = this.extractCookie(cookieHeader);
    if (!token || !origin) throw new UnauthorizedException('Session publique absente.');
    const principal = await this.sessions.validate(token);
    const [integration] = await this.drizzle.db
      .select({ allowedOrigins: supportIntegrations.allowedOrigins })
      .from(supportIntegrations)
      .where(eq(supportIntegrations.id, principal.supportIntegrationId))
      .limit(1);
    if (!integration?.allowedOrigins.includes(origin)) throw new UnauthorizedException('Origine non autorisée.');
    return principal;
  }

  private extractCookie(header: string | undefined): string | null {
    if (!header) return null;
    const name = this.cookieName();
    const values = header
      .split(';')
      .map((part) => part.trim())
      .filter((part) => part.startsWith(`${name}=`))
      .map((part) => part.slice(name.length + 1));
    if (values.length !== 1 || !values[0]) return null;
    try {
      return decodeURIComponent(values[0]);
    } catch {
      return null;
    }
  }

  private cookieName(): string {
    const configured = process.env['PUBLIC_WS_COOKIE_NAME'];
    if (process.env['NODE_ENV'] !== 'production') return configured || 'support_session';
    const name = configured || '__Host-support_session';
    if (!name.startsWith('__Host-')) throw new Error('PUBLIC_WS_COOKIE_NAME doit utiliser __Host- en production.');
    return name;
  }
}
