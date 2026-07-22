import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { JwtPayload } from '../modules/auth/interfaces/jwt-payload.interface';
import { JwtStrategy } from '../modules/auth/strategies/jwt.strategy';

@Injectable()
export class WebSocketAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly jwtStrategy: JwtStrategy,
  ) {}

  async authenticate(cookieHeader: string | undefined): Promise<JwtPayload> {
    const token = this.extractAccessToken(cookieHeader);
    if (!token) throw new UnauthorizedException('Cookie de session absent.');

    const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    return this.jwtStrategy.validate(payload);
  }

  private extractAccessToken(cookieHeader: string | undefined): string | null {
    if (!cookieHeader) return null;
    const cookieName = process.env['AUTH_ACCESS_COOKIE_NAME'] || 'access_token';
    const values = cookieHeader
      .split(';')
      .map((part) => part.trim())
      .filter((part) => part.startsWith(`${cookieName}=`))
      .map((part) => part.slice(cookieName.length + 1));

    if (values.length !== 1 || !values[0]) return null;
    try {
      return decodeURIComponent(values[0]);
    } catch {
      return null;
    }
  }
}
