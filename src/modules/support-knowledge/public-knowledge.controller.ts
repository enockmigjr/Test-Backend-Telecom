import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiExtraModels, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Auth, AuthMode } from '../../common/decorators/auth-mode.decorator';
import { PublicSupportApi } from '../../common/openapi/public-support-api.decorator';
import { PublicSupportRequest, requirePublicPrincipal } from '../public-support/public-request';
import { PublicKnowledgeSearchQueryDto } from './dto/knowledge-article.dto';
import { KnowledgeSearchResultDto } from './dto/knowledge-response.dto';
import { PublicKnowledgeService } from './services/public-knowledge.service';

@ApiTags('Support public - connaissance')
@ApiBearerAuth('publicSession')
@ApiExtraModels(KnowledgeSearchResultDto)
@Auth(AuthMode.PUBLIC_SESSION)
@PublicSupportApi()
@Controller('public-support/knowledge')
export class PublicKnowledgeController {
  constructor(private readonly knowledge: PublicKnowledgeService) {}

  @Get('search')
  @PublicSupportApi()
  @ApiOperation({ summary: 'Rechercher des articles publics de cette intégration' })
  @ApiResponse({ status: 200, description: 'Résultats de recherche.' })
  search(@Req() request: PublicSupportRequest, @Query() query: PublicKnowledgeSearchQueryDto) {
    return this.knowledge.search(requirePublicPrincipal(request).supportIntegrationId, query.q, query.limit);
  }

  @Get(':slug')
  @PublicSupportApi()
  @ApiOperation({ summary: 'Consulter un article public par slug' })
  @ApiResponse({ status: 200, description: 'Article trouvé.' })
  @ApiResponse({ status: 404, description: 'Article indisponible pour cette intégration.' })
  findBySlug(@Req() request: PublicSupportRequest, @Param('slug') slug: string) {
    return this.knowledge.findBySlug(requirePublicPrincipal(request).supportIntegrationId, slug);
  }
}
