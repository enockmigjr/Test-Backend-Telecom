import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiExtraModels, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateKnowledgeArticleDto, KnowledgeQueryDto, UpdateKnowledgeArticleDto } from './dto/knowledge-article.dto';
import {
  KnowledgeArticleDetailDto,
  KnowledgeArticleListItemDto,
  KnowledgeArticleVersionDto,
  KnowledgeIntegrationRefDto,
} from './dto/knowledge-response.dto';
import { SupportKnowledgeService } from './services/support-knowledge.service';

@ApiTags('support-knowledge')
@ApiBearerAuth()
@ApiExtraModels(
  KnowledgeArticleDetailDto,
  KnowledgeArticleListItemDto,
  KnowledgeArticleVersionDto,
  KnowledgeIntegrationRefDto,
)
@UseGuards(RolesGuard)
@Controller('support-knowledge')
export class SupportKnowledgeController {
  constructor(private readonly knowledge: SupportKnowledgeService) {}

  @Get()
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({
    summary: 'Liste paginée des articles de connaissance',
    description: 'Articles éditorialisés, cloisonnés par intégration. Lecture ADMINISTRATOR/SUPERVISOR.',
  })
  @ApiResponse({ status: 200, description: 'Liste paginée des articles.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant.' })
  list(@Query() query: KnowledgeQueryDto) {
    return this.knowledge.list(query);
  }

  @Get(':id')
  @Roles('ADMINISTRATOR', 'SUPERVISOR')
  @ApiOperation({
    summary: 'Consulter un article avec son historique',
    description: 'Détail, intégrations autorisées et versions append-only. Lecture ADMINISTRATOR/SUPERVISOR.',
  })
  @ApiResponse({ status: 200, description: 'Article trouvé.' })
  @ApiResponse({ status: 404, description: 'Article introuvable.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.knowledge.detail(id);
  }

  @Post()
  @Roles('ADMINISTRATOR')
  @ApiOperation({
    summary: 'Créer un article de connaissance',
    description:
      'Crée l’article en brouillon avec sa première version et ses intégrations autorisées. Écriture ADMINISTRATOR.',
  })
  @ApiResponse({ status: 201, description: 'Article créé.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant.' })
  create(@Body() dto: CreateKnowledgeArticleDto, @CurrentUser() user: JwtPayload) {
    return this.knowledge.create(dto, user.sub);
  }

  @Patch(':id')
  @Roles('ADMINISTRATOR')
  @ApiOperation({
    summary: 'Modifier, publier ou archiver un article',
    description:
      'Chaque changement de contenu crée une nouvelle version ; la publication et l’archivage sont tracés. Écriture ADMINISTRATOR.',
  })
  @ApiResponse({ status: 200, description: 'Article mis à jour.' })
  @ApiResponse({ status: 404, description: 'Article introuvable.' })
  @ApiResponse({ status: 401, description: 'Token JWT manquant ou expiré.' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateKnowledgeArticleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.knowledge.update(id, dto, user.sub);
  }
}
