import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Mot de passe actuel' })
  @IsString({ message: 'Le mot de passe actuel est requis.' })
  currentPassword: string;

  @ApiProperty({ description: 'Nouveau mot de passe (min 8 car., 1 maj, 1 min, 1 chiffre, 1 spécial)' })
  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères.' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial.',
  })
  newPassword: string;
}
