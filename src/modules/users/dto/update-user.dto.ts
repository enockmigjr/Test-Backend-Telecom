import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, IsIn, MaxLength, IsOptional } from 'class-validator';

const VALID_ROLES = [
  'ADMINISTRATOR',
  'SUPERVISOR',
  'CUSTOMER_SERVICE_AGENT',
  'NOC_ENGINEER',
  'BILLING_AGENT',
  'TECHNICAL_SUPPORT_ENGINEER',
  'FIELD_TECHNICIAN',
] as const;

export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'Prénom' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ description: 'Nom de famille' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ description: 'Rôle', enum: VALID_ROLES })
  @IsOptional()
  @IsString()
  @IsIn(VALID_ROLES)
  role?: string;

  @ApiPropertyOptional({ description: 'ID du département (UUID)' })
  @IsOptional()
  @IsUUID('4')
  departmentId?: string;
}
