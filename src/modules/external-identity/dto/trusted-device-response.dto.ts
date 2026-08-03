import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PublicSuccessResponseDto } from '../../public-support/dto/public-response-envelope.dto';

class TrustedDeviceDataDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  current: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  lastUsedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  revokedAt: Date | null;
}

export class TrustedDeviceListResponseDto extends PublicSuccessResponseDto {
  @ApiProperty({ type: TrustedDeviceDataDto, isArray: true })
  data: TrustedDeviceDataDto[];
}
