import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsUUID, Length, MaxLength, MinLength } from 'class-validator';

export class RequestEmailVerificationDto {
  @ApiProperty({ description: "Clé publique de l'intégration" })
  @IsString()
  @MinLength(16)
  @MaxLength(80)
  integrationKey: string;

  @ApiProperty({ example: 'client@example.com' })
  @IsEmail()
  @MaxLength(255)
  email: string;
}

export class ConsumeEmailVerificationDto {
  @ApiProperty()
  @IsUUID()
  challengeId: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code: string;
}
