import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PublicPrincipal } from '../modules/external-identity/interfaces/public-principal.interface';
import { PublicSessionService } from '../modules/external-identity/services/public-session.service';
import { isPublicWebsocketOriginAllowed } from './public-websocket-cors';

export type PublicWebSocketContext = 'portal' | 'widget';

@Injectable()
export class PublicWebSocketAuthService {
  constructor(private readonly sessions: PublicSessionService) {}

  async authenticate(
    cookieHeader: string | undefined,
    origin: string | undefined,
    context: PublicWebSocketContext | null,
  ): Promise<PublicPrincipal> {
    const token = context ? this.extractCookie(cookieHeader, this.cookieNames()[context]) : null;
    if (!token || !origin) throw new UnauthorizedException('Session publique absente.');
    if (!isPublicWebsocketOriginAllowed(origin)) throw new UnauthorizedException('Origine non autorisée.');
    return this.sessions.validate(token);
  }

  private extractCookie(header: string | undefined, name: string): string | null {
    if (!header) return null;
    const cookies = header.split(';').map((part) => part.trim());
    const values = cookies.filter((part) => part.startsWith(`${name}=`)).map((part) => part.slice(name.length + 1));
    if (values.length !== 1 || !values[0]) return null;
    try {
      return decodeURIComponent(values[0]);
    } catch {
      return null;
    }
  }

  private cookieNames(): Readonly<Record<PublicWebSocketContext, string>> {
    const configured = process.env['PUBLIC_WS_COOKIE_NAME'];
    const fallback =
      process.env['NODE_ENV'] === 'production'
        ? ['__Host-support_session', '__Host-support_iframe_session']
        : ['support_session', 'support_iframe_session'];
    const names = configured
      ? configured
          .split(',')
          .map((name) => name.trim())
          .filter(Boolean)
      : fallback;
    const [portal, widget] = names;
    if (!portal || !widget || names.length !== 2 || portal === widget) {
      throw new Error('PUBLIC_WS_COOKIE_NAME doit contenir les cookies portail et widget, uniques et dans cet ordre.');
    }
    if (process.env['NODE_ENV'] === 'production' && names.some((name) => !name.startsWith('__Host-'))) {
      throw new Error('PUBLIC_WS_COOKIE_NAME doit utiliser __Host- en production.');
    }
    return { portal, widget };
  }
}

export function publicWebSocketContext(value: unknown): PublicWebSocketContext | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const context = Reflect.get(value, 'context');
  return context === 'portal' || context === 'widget' ? context : null;
}
