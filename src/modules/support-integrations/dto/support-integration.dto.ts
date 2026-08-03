import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IntegrationQuotaPolicyDto, IntegrationTrustPolicyDto } from './integration-policy.dto';

export class CreateSupportIntegrationDto {
  @ApiProperty({ example: 'PhotoVault production' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name: string;

  @ApiProperty({ type: [String], example: ['https://photos.example.com'] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  allowedOrigins: string[];

  @ApiPropertyOptional({ type: IntegrationTrustPolicyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => IntegrationTrustPolicyDto)
  trustPolicy?: IntegrationTrustPolicyDto;

  @ApiPropertyOptional({ type: IntegrationQuotaPolicyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => IntegrationQuotaPolicyDto)
  quotaPolicy?: IntegrationQuotaPolicyDto;

  @ApiPropertyOptional({ type: 'object' })
  @IsOptional()
  @IsObject()
  appearance?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object' })
  @IsOptional()
  @IsObject()
  routingPolicy?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object' })
  @IsOptional()
  @IsObject()
  features?: Record<string, boolean>;
}

export class UpdateSupportIntegrationDto extends PartialType(CreateSupportIntegrationDto) {
  @ApiPropertyOptional({ enum: ['DRAFT', 'ACTIVE', 'SUSPENDED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'SUSPENDED'])
  status?: 'DRAFT' | 'ACTIVE' | 'SUSPENDED';
}

export class RotateIntegrationSecretDto {
  @ApiProperty({ description: 'Secret aléatoire de 32 octets encodé en base64url; il ne sera jamais renvoyé.' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  secret: string;
}
