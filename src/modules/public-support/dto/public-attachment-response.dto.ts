import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PublicSuccessResponseDto } from './public-response-envelope.dto';

const SCAN_STATUSES = ['NOT_REQUIRED', 'QUARANTINED', 'PENDING', 'SCANNING', 'CLEAN', 'INFECTED', 'ERROR'] as const;

export class PublicAttachmentDataDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  filename: string;

  @ApiPropertyOptional()
  mimeType?: string;

  @ApiProperty({ minimum: 0 })
  fileSize: number;

  @ApiProperty({ enum: SCAN_STATUSES })
  scanStatus: (typeof SCAN_STATUSES)[number];

  @ApiPropertyOptional({ type: String, nullable: true })
  error?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  createdAt?: Date;
}

export class PublicAttachmentResponseDto extends PublicSuccessResponseDto {
  @ApiProperty({ type: PublicAttachmentDataDto })
  data: PublicAttachmentDataDto;
}

export class PublicAttachmentListResponseDto extends PublicSuccessResponseDto {
  @ApiProperty({ type: PublicAttachmentDataDto, isArray: true })
  data: PublicAttachmentDataDto[];
}
