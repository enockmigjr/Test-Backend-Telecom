import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class PublicIntegrationConfigQueryDto {
  @ApiProperty({ description: "Clé publique de l'intégration", minLength: 16, maxLength: 80 })
  @IsString()
  @MinLength(16)
  @MaxLength(80)
  integrationKey: string;

  @ApiProperty({ required: false, description: "Origine exacte demandant l'intégration en iframe" })
  @IsOptional()
  @IsUrl({ require_protocol: true, require_tld: false, protocols: ['http', 'https'] })
  @MaxLength(2048)
  origin?: string;
}
