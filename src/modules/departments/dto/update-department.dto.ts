import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MaxLength, IsOptional } from 'class-validator';

export class UpdateDepartmentDto {
  @ApiPropertyOptional({ description: 'Nouveau nom du département' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Nouvelle description' })
  @IsOptional()
  @IsString()
  description?: string;
}
