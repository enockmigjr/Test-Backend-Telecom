import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Adresse email de l\'utilisateur',
    example: 'admin@telecom.local',
    format: 'email',
    minLength: 5,
  })
  @IsEmail({}, { message: "L'adresse email fournie n'est pas valide." })
  email: string;

  @ApiProperty({
    description: 'Mot de passe (8 car. min, 1 maj, 1 min, 1 chiffre, 1 spécial)',
    example: 'Admin@1234',
    minLength: 8,
    format: 'password',
  })
  @IsString()
  @MinLength(1, { message: 'Le mot de passe est requis.' })
  password: string;
}
