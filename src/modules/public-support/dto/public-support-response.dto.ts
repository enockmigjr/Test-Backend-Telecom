import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PublicSuccessResponseDto } from './public-response-envelope.dto';

class PublicCategoryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  description: string | null;
}

class PublicServiceDto {
  @ApiProperty()
  key: string;

  @ApiProperty()
  label: string;
}

class PublicCatalogDataDto {
  @ApiProperty({ type: PublicCategoryDto, isArray: true })
  categories: PublicCategoryDto[];

  @ApiProperty({ type: PublicServiceDto, isArray: true })
  services: PublicServiceDto[];
}

export class PublicCatalogResponseDto extends PublicSuccessResponseDto {
  @ApiProperty({ type: PublicCatalogDataDto })
  data: PublicCatalogDataDto;
}

class PublicConversationStateDataDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: ['QUALIFY', 'DRAFT'] })
  state: 'QUALIFY' | 'DRAFT';
}

export class PublicConversationStateResponseDto extends PublicSuccessResponseDto {
  @ApiProperty({ type: PublicConversationStateDataDto })
  data: PublicConversationStateDataDto;
}

export class PublicTicketDraftDataDto {
  @ApiProperty({ format: 'uuid' })
  categoryId: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH'] })
  impact: 'LOW' | 'MEDIUM' | 'HIGH';

  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH'] })
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';

  @ApiPropertyOptional()
  customerAccountNumber?: string;

  @ApiPropertyOptional()
  serviceKey?: string;
}

class PublicDraftSavedDataDto extends PublicConversationStateDataDto {
  @ApiProperty({ type: PublicTicketDraftDataDto })
  draft: PublicTicketDraftDataDto;
}

export class PublicDraftSavedResponseDto extends PublicSuccessResponseDto {
  @ApiProperty({ type: PublicDraftSavedDataDto })
  data: PublicDraftSavedDataDto;
}

class PublicTicketConfirmedDataDto {
  @ApiProperty({ format: 'uuid' })
  conversationId: string;

  @ApiProperty({ format: 'uuid' })
  ticketId: string;

  @ApiProperty()
  ticketNumber: string;
}

export class PublicTicketConfirmedResponseDto extends PublicSuccessResponseDto {
  @ApiProperty({ type: PublicTicketConfirmedDataDto })
  data: PublicTicketConfirmedDataDto;
}

class PublicHandoffDataDto {
  @ApiProperty({ format: 'uuid' })
  conversationId: string;

  @ApiProperty({ enum: ['FOLLOW_UP_OR_HANDOFF'] })
  state: 'FOLLOW_UP_OR_HANDOFF';
}

export class PublicHandoffResponseDto extends PublicSuccessResponseDto {
  @ApiProperty({ type: PublicHandoffDataDto })
  data: PublicHandoffDataDto;
}

class PublicPreferencesDataDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  displayName: string | null;

  @ApiProperty()
  locale: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  lastSeenAt?: Date | null;
}

export class PublicPreferencesResponseDto extends PublicSuccessResponseDto {
  @ApiProperty({ type: PublicPreferencesDataDto, nullable: true })
  data: PublicPreferencesDataDto | null;
}
