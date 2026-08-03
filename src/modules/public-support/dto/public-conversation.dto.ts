import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreatePublicConversationDto {
  @ApiPropertyOptional({ maxLength: 80, example: 'internet-fixe' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  serviceKey?: string;
}

export class SavePublicTicketDraftDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  categoryId: string;

  @ApiProperty({ minLength: 5, maxLength: 255 })
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  title: string;

  @ApiProperty({ minLength: 10, maxLength: 10_000 })
  @IsString()
  @MinLength(10)
  @MaxLength(10_000)
  description: string;

  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH'] })
  @IsIn(['LOW', 'MEDIUM', 'HIGH'])
  impact: 'LOW' | 'MEDIUM' | 'HIGH';

  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH'] })
  @IsIn(['LOW', 'MEDIUM', 'HIGH'])
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  customerAccountNumber?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  serviceKey?: string;
}

export class ConfirmPublicTicketDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  confirmed: boolean;
}

export class PublicHandoffDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
