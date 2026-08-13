/**
 * ============================================================================
 * FICHIER : src/modules/auth/auth.controller.ts
 * RÔLE : Contrôleur REST des routes d'authentification (`/api/v1/auth`).
 * EXPLICATION :
 * Keycloak est le seul fournisseur d'authentification. Les anciennes routes
 * locales (login, refresh, logout, logout-all, change-password) ont été
 * supprimées : la session est validée par la stratégie JWT (RS256 Keycloak,
 * profil métier lié via keycloakSubjectId) et ce contrôleur expose uniquement
 * le profil de la session courante.
 * ============================================================================
 */

import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from './interfaces/jwt-payload.interface';

/**
 * Class AuthController
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  /** Route de lecture des informations de la session courante */
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Profil de l'utilisateur connecté" })
  me(@CurrentUser() user: JwtPayload) {
    return user;
  }
}
