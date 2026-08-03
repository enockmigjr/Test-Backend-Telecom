import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PublicSuccessResponseDto } from '../../public-support/dto/public-response-envelope.dto';

class VerificationRequestDataDto {
  @ApiProperty({ format: 'uuid' })
  challengeId: string;
}

export class VerificationRequestResponseDto extends PublicSuccessResponseDto {
  @ApiProperty({ type: VerificationRequestDataDto })
  data: VerificationRequestDataDto;

  @ApiProperty()
  message: string;
}

export class PublicSessionDataDto {
  @ApiPropertyOptional({ type: Boolean })
  verified?: boolean;

  @ApiProperty()
  accessToken: string;

  @ApiProperty({ minimum: 1 })
  expiresIn: number;

  @ApiProperty()
  trustedDeviceToken: string;

  @ApiProperty({ type: String, format: 'date-time' })
  trustedDeviceExpiresAt: Date;
}

export class PublicSessionResponseDto extends PublicSuccessResponseDto {
  @ApiProperty({ type: PublicSessionDataDto })
  data: PublicSessionDataDto;
}

class VerificationRejectedDataDto {
  @ApiProperty({ type: Boolean, enum: [false] })
  verified: boolean;
}

export class VerificationRejectedResponseDto extends PublicSuccessResponseDto {
  @ApiProperty({ type: VerificationRejectedDataDto })
  data: VerificationRejectedDataDto;
}

class BootstrapGrantDataDto {
  @ApiProperty()
  code: string;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt: Date;
}

export class BootstrapGrantResponseDto extends PublicSuccessResponseDto {
  @ApiProperty({ type: BootstrapGrantDataDto })
  data: BootstrapGrantDataDto;
}

class DeviceRevokedDataDto {
  @ApiProperty({ type: Boolean, enum: [true] })
  revoked: boolean;
}

export class DeviceRevokedResponseDto extends PublicSuccessResponseDto {
  @ApiProperty({ type: DeviceRevokedDataDto })
  data: DeviceRevokedDataDto;
}
