import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PublicPaginationMetaDto, PublicSuccessResponseDto } from './public-response-envelope.dto';

const PUBLIC_TICKET_STATUSES = ['RECEIVED', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED'] as const;

class PublicTicketSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  ticketNumber: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ enum: PUBLIC_TICKET_STATUSES })
  status: (typeof PUBLIC_TICKET_STATUSES)[number];

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;
}

export class PublicTicketListResponseDto extends PublicSuccessResponseDto {
  @ApiProperty({ type: PublicTicketSummaryDto, isArray: true })
  data: PublicTicketSummaryDto[];

  @ApiProperty({ type: PublicPaginationMetaDto })
  meta: PublicPaginationMetaDto;
}

class PublicTicketDetailDto extends PublicTicketSummaryDto {
  @ApiProperty()
  description: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  firstResponseDueAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  resolutionDueAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  resolvedAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  closedAt: Date | null;
}

export class PublicTicketDetailResponseDto extends PublicSuccessResponseDto {
  @ApiProperty({ type: PublicTicketDetailDto })
  data: PublicTicketDetailDto;
}

class PublicTimelineEntryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: ['COMMENT', 'STATUS'] })
  type: 'COMMENT' | 'STATUS';

  @ApiPropertyOptional()
  content?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  correctsCommentId?: string | null;

  @ApiPropertyOptional()
  author?: string;

  @ApiPropertyOptional({ enum: PUBLIC_TICKET_STATUSES })
  status?: (typeof PUBLIC_TICKET_STATUSES)[number];

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

export class PublicTimelineResponseDto extends PublicSuccessResponseDto {
  @ApiProperty({ type: PublicTimelineEntryDto, isArray: true })
  data: PublicTimelineEntryDto[];
}

class PublicCommentDataDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  content: string;
}

export class PublicCommentResponseDto extends PublicSuccessResponseDto {
  @ApiProperty({ type: PublicCommentDataDto })
  data: PublicCommentDataDto;
}
