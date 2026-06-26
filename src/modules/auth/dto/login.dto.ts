import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: 'Adresse email', example: 'admin@telecom.local' })
  @IsEmail({}, { message: "L'adresse email fournie n'est pas valide." })
  email: string;

  @ApiProperty({ description: 'Mot de passe', example: 'Admin@1234' })
  @IsString()
  @MinLength(1, { message: 'Le mot de passe est requis.' })
  password: string;
}
