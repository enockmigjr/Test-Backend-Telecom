import { Controller, Get, Param, ParseUUIDPipe, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth, AuthMode } from '../../common/decorators/auth-mode.decorator';
import { PublicSupportApi } from '../../common/openapi/public-support-api.decorator';
import { PublicConversationDetailResponseDto } from './dto/public-portal-response.dto';
import { PublicSupportRequest, requirePublicPrincipal } from './public-request';
import { PublicConversationService } from './services/public-conversation.service';

@ApiTags('Support public - demandes')
@ApiBearerAuth('publicSession')
@Auth(AuthMode.PUBLIC_SESSION)
@PublicSupportApi()
@Controller('public-support/conversations')
export class PublicConversationResumeController {
  constructor(private readonly conversations: PublicConversationService) {}

  @Get(':id')
  @PublicSupportApi()
  @ApiOperation({ summary: 'Reprendre une conversation ou son brouillon' })
  @ApiOkResponse({ type: PublicConversationDetailResponseDto })
  get(@Param('id', ParseUUIDPipe) id: string, @Req() request: PublicSupportRequest) {
    return this.conversations.get(id, requirePublicPrincipal(request));
  }
}
