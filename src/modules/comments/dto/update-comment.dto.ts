import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

export class UpdateCommentDto {
  @ApiProperty({
    description: 'Contenu mis à jour du commentaire',
    example: 'Mise à jour : le technicien a identifié la panne, intervention en cours.',
    minLength: 1,
    maxLength: 5000,
  })
  @IsString({ message: 'Le contenu est requis.' })
  @MinLength(1, { message: 'Le contenu ne peut pas être vide.' })
  @MaxLength(5000, { message: 'Le contenu ne peut pas dépasser 5000 caractères.' })
  content: string;
}
