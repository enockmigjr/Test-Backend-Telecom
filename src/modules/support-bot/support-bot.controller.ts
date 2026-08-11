import { Body, Controller, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiExtraModels, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Auth, AuthMode } from '../../common/decorators/auth-mode.decorator';
import { RequireIdempotency } from '../../common/decorators/idempotent.decorator';
import { PublicSupportApi } from '../../common/openapi/public-support-api.decorator';
import { PublicSupportRequest, requirePublicPrincipal } from '../public-support/public-request';
import { BotMessageDto } from './dto/bot-message.dto';
import { BotReplyDto } from './dto/bot-response.dto';
import { SupportBotService } from './services/support-bot.service';

@ApiTags('Support public - bot')
@ApiBearerAuth('publicSession')
@ApiExtraModels(BotReplyDto)
@Auth(AuthMode.PUBLIC_SESSION)
@PublicSupportApi()
@Controller('public-support/conversations/:id/bot')
export class SupportBotController {
  constructor(private readonly bot: SupportBotService) {}

  @Post()
  @RequireIdempotency()
  @PublicSupportApi()
  @ApiOperation({
    summary: 'Envoyer un message au bot de la conversation',
    description:
      'Répond avec le mode disabled/unavailable tant qu’aucun fournisseur IA n’est configuré : le formulaire reste le chemin de création.',
  })
  @ApiResponse({ status: 201, description: 'Réponse du bot.' })
  @ApiResponse({ status: 409, description: 'Conversation finalisée.' })
  @ApiResponse({ status: 404, description: 'Conversation introuvable.' })
  reply(@Param('id', ParseUUIDPipe) id: string, @Req() request: PublicSupportRequest, @Body() dto: BotMessageDto) {
    return this.bot.reply(requirePublicPrincipal(request), id, dto.message);
  }
}
