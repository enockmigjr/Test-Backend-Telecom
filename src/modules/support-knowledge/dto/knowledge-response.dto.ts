import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;

export class KnowledgeArticleListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  summary?: string | null;

  @ApiProperty({ enum: STATUSES })
  status: string;

  @ApiProperty()
  language: string;

  @ApiPropertyOptional({ nullable: true })
  publishedAt?: Date | null;

  @ApiProperty()
  integrationCount: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class KnowledgeArticleVersionDto {
  @ApiProperty()
  version: number;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  summary?: string | null;

  @ApiProperty()
  content: string;

  @ApiProperty()
  language: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  note?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  createdBy?: string | null;

  @ApiProperty()
  createdAt: Date;
}

export class KnowledgeIntegrationRefDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;
}

export class KnowledgeArticleDetailDto extends KnowledgeArticleListItemDto {
  @ApiProperty()
  content: string;

  @ApiProperty({ type: [KnowledgeIntegrationRefDto] })
  integrations: KnowledgeIntegrationRefDto[];

  @ApiProperty({ type: [KnowledgeArticleVersionDto] })
  versions: KnowledgeArticleVersionDto[];
}

export class KnowledgeSearchResultDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  summary?: string | null;

  @ApiProperty()
  content: string;

  @ApiProperty()
  language: string;

  @ApiProperty()
  updatedAt: Date;
}
