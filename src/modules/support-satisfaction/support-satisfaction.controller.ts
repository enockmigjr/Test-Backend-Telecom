/**
 * Contrôleur de satisfaction : création du lien (interne) et soumission (public).
 */
import { Body, Controller, Param, ParseUUIDPipe, Post, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Auth, AuthMode } from '../../common/decorators/auth-mode.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { SupportSatisfactionService } from './support-satisfaction.service';
import { SubmitSatisfactionDto } from './dto/submit-satisfaction.dto';

@ApiTags('Support public - satisfaction')
@Controller('public-support')
export class PublicSatisfactionController {
  constructor(private readonly service: SupportSatisfactionService) {}

  /** Soumission publique de la note (lien signé reçu par email). */
  @Post('tickets/:ticketId/satisfaction')
  @Auth(AuthMode.ANONYMOUS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soumettre une note de satisfaction' })
  @ApiResponse({ status: 200, description: 'Satisfaction enregistrée.' })
  @ApiResponse({ status: 404, description: 'Lien invalide.' })
  async submit(@Param('ticketId', ParseUUIDPipe) ticketId: string, @Body() dto: SubmitSatisfactionDto) {
    return this.service.submit(ticketId, dto.token, dto.note, dto.comment);
  }
}

@ApiTags('Tickets - satisfaction')
@ApiBearerAuth()
@Controller('tickets')
@UseGuards(RolesGuard)
@Auth(AuthMode.INTERNAL)
export class InternalSatisfactionController {
  constructor(private readonly service: SupportSatisfactionService) {}

  /** Génère un lien de satisfaction pour un ticket (admin/superviseur). */
  @Post(':ticketId/satisfaction-token')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Générer un lien de satisfaction' })
  @ApiResponse({ status: 201, description: 'Lien de satisfaction généré.' })
  async createToken(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    // L'utilisateur courant est requis par le guard JWT global ; il n'est pas utilisé ici.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @CurrentUser() _user: JwtPayload,
  ) {
    return this.service.createForTicket(ticketId);
  }
}
