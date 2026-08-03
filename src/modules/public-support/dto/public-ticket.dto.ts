import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreatePublicCommentDto {
  @ApiProperty({ minLength: 1, maxLength: 10_000 })
  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  content: string;
}

export class UpdatePublicPreferencesDto {
  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  displayName?: string;

  @ApiPropertyOptional({ maxLength: 16, example: 'fr' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  locale?: string;
}
