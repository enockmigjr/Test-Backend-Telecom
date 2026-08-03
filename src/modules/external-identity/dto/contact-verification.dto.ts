import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsUUID, Length, MaxLength, MinLength } from 'class-validator';

export class RequestEmailVerificationDto {
  @ApiProperty({ description: "Clé publique de l'intégration", minLength: 16, maxLength: 80 })
  @IsString()
  @MinLength(16)
  @MaxLength(80)
  integrationKey: string;

  @ApiProperty({ example: 'client@example.com', format: 'email', maxLength: 255 })
  @IsEmail()
  @MaxLength(255)
  email: string;
}

export class ConsumeEmailVerificationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  challengeId: string;

  @ApiProperty({ example: '123456', minLength: 6, maxLength: 6 })
  @IsString()
  @Length(6, 6)
  code: string;
}
