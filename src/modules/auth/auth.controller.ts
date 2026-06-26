import { Controller, Post, Body, Req, HttpCode, HttpStatus, Get, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 3600000 } })
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

  @Public()
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

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Déconnexion (révoque le refresh token fourni)' })
  @ApiResponse({ status: 204, description: 'Déconnexion réussie.' })
  async logout(@Body() dto: RefreshDto) {
    await this.authService.logout(dto.refreshToken);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Déconnexion de toutes les sessions actives' })
  @ApiResponse({ status: 204, description: 'Toutes les sessions sont révoquées.' })
  async logoutAll(@CurrentUser() user: JwtPayload) {
    await this.authService.logoutAll(user.sub);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Profil de l'utilisateur connecté" })
  async me(@CurrentUser() user: JwtPayload) {
    return user;
  }

  @Put('change-password')
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
