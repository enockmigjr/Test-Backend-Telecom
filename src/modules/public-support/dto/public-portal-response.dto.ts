import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PublicSuccessResponseDto } from './public-response-envelope.dto';
import { PublicTicketDraftDataDto } from './public-support-response.dto';

class PublicAppearanceDto {
  @ApiPropertyOptional()
  supportName?: string;

  @ApiPropertyOptional()
  welcomeTitle?: string;

  @ApiPropertyOptional()
  welcomeMessage?: string;

  @ApiPropertyOptional({ pattern: '^#[0-9A-F]{6}$' })
  primaryColor?: string;

  @ApiPropertyOptional({ pattern: '^#[0-9A-F]{6}$' })
  accentColor?: string;

  @ApiPropertyOptional({ format: 'uri' })
  logoUrl?: string;
}

class PublicIntegrationFeaturesDto {
  @ApiProperty()
  publicAttachments: boolean;

  @ApiProperty()
  publicRealtime: boolean;

  @ApiProperty()
  publicBot: boolean;
}

class PublicIntegrationConfigDataDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  frameAllowed: boolean;

  @ApiProperty({ type: PublicAppearanceDto })
  appearance: PublicAppearanceDto;

  @ApiProperty({ type: PublicIntegrationFeaturesDto })
  features: PublicIntegrationFeaturesDto;
}

export class PublicIntegrationConfigResponseDto extends PublicSuccessResponseDto {
  @ApiProperty({ type: PublicIntegrationConfigDataDto })
  data: PublicIntegrationConfigDataDto;
}

class PublicConversationDetailDataDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  state: string;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  ticketId: string | null;

  @ApiPropertyOptional({ type: PublicTicketDraftDataDto, nullable: true })
  draft: PublicTicketDraftDataDto | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  lastMessageAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

export class PublicConversationDetailResponseDto extends PublicSuccessResponseDto {
  @ApiProperty({ type: PublicConversationDetailDataDto })
  data: PublicConversationDetailDataDto;
}
