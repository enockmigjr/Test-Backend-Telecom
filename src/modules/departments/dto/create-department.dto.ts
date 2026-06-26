import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MaxLength, IsOptional } from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({ description: 'Nom du département', example: 'Customer Care' })
  @IsString({ message: 'Le nom du département est requis.' })
  @MaxLength(100, { message: 'Le nom du département ne peut pas dépasser 100 caractères.' })
  name: string;

  @ApiPropertyOptional({ description: 'Description du département' })
  @IsOptional()
  @IsString()
  description?: string;
}
