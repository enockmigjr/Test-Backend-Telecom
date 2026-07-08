import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSettingDto {
  @ApiProperty({ description: 'Valeur de la configuration', example: '10' })
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiProperty({ description: 'Description optionnelle', example: 'Nouvelle limite de tickets', required: false })
  @IsString()
  @IsOptional()
  description?: string;
}
