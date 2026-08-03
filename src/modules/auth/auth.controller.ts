/**
 * ============================================================================
 * FICHIER : src/modules/auth/auth.controller.ts
 * RÔLE : Contrôleur REST des routes d'authentification (`/api/v1/auth`).
 * EXPLICATION :
 * Ce fichier gère tous les échanges de connexion, déconnexion et gestion des jetons :
 * - `POST /auth/login` : Connexion avec email et mot de passe.
 * - `POST /auth/refresh` : Renouvellement des jetons d'accès expiré (rotation).
 * - `POST /auth/logout` : Déconnexion d'un appareil (invalidation du jeton).
 * - `POST /auth/logout-all` : Déconnexion de toutes les sessions actives (tous les appareils).
 * - `GET /auth/me` : Lecture des informations du profil connecté.
 * - `PUT /auth/change-password` : Modification du mot de passe.
 * ============================================================================
 */

import { Controller, Post, Body, Req, HttpCode, HttpStatus, Get, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Auth, AuthMode } from '../../common/decorators/auth-mode.decorator';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { AllowPasswordChangePending } from '../../common/decorators/allow-password-change-pending.decorator';
import { AuthRateLimited } from '../../common/decorators/auth-rate-limited.decorator';

/**
 * Class AuthController
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Route publique de connexion */
  @Auth(AuthMode.ANONYMOUS)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @AuthRateLimited()
  @ApiOperation({ summary: 'Connexion utilisateur' })
  @ApiResponse({ status: 200, description: 'Authentification réussie.' })
  @ApiResponse({ status: 401, description: 'Identifiants invalides.' })
  @ApiResponse({ status: 403, description: 'Compte désactivé.' })
  @ApiResponse({ status: 429, description: 'Trop de tentatives.' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const ipAddress = (req.ip || req.socket.remoteAddress) ?? 'unknown';
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';
    return this.authService.login(dto.email, dto.password, ipAddress, userAgent);
  }

  /** Route publique de rafraîchissement des tokens */
  @Auth(AuthMode.ANONYMOUS)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rafraîchir la paire de tokens (rotation)' })
  @ApiResponse({ status: 200, description: 'Nouveaux tokens générés.' })
  @ApiResponse({ status: 401, description: 'Refresh token invalide ou expiré.' })
  async refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    const ipAddress = (req.ip || req.socket.remoteAddress) ?? 'unknown';
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';
    return this.authService.refresh(dto.refreshToken, ipAddress, userAgent);
  }

  /** Route de déconnexion simple */
  @Post('logout')
  @AllowPasswordChangePending()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Déconnexion (révoque le refresh token + blackliste l'access token)" })
  @ApiResponse({ status: 204, description: "Déconnexion réussie. L'access token est immédiatement invalide." })
  async logout(@Body() dto: RefreshDto, @CurrentUser() user: JwtPayload) {
    await this.authService.logout(dto.refreshToken, user.jti, user.sub);
  }

  /** Route de déconnexion de toutes les sessions actives (tous les appareils) */
  @Post('logout-all')
  @AllowPasswordChangePending()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Déconnexion de toutes les sessions actives' })
  @ApiResponse({ status: 204, description: 'Toutes les sessions sont révoquées.' })
  async logoutAll(@CurrentUser() user: JwtPayload) {
    await this.authService.logoutAll(user.sub, user.jti);
  }

  /** Route de lecture des informations de la session courante */
  @Get('me')
  @AllowPasswordChangePending()
  @ApiBearerAuth()
  @ApiOperation({ summary: "Profil de l'utilisateur connecté" })
  async me(@CurrentUser() user: JwtPayload) {
    return user;
  }

  /** Route de modification du mot de passe */
  @Put('change-password')
  @AllowPasswordChangePending()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Changer le mot de passe' })
  @ApiResponse({ status: 200, description: 'Mot de passe modifié avec succès.' })
  @ApiResponse({ status: 400, description: 'Mot de passe invalide.' })
  @ApiResponse({ status: 401, description: 'Mot de passe actuel incorrect.' })
  async changePassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangePasswordDto) {
    await this.authService.changePassword(user.sub, dto.currentPassword, dto.newPassword);
    return { message: 'Mot de passe modifié avec succès.' };
  }
}
