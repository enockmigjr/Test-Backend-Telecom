import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ConsumeBootstrapDto {
  @ApiProperty({ description: 'Code opaque extrait du fragment puis envoyé en POST', minLength: 32, maxLength: 128 })
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  code: string;
}
