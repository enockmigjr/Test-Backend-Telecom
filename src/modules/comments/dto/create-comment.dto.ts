import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({
    description: 'Contenu du commentaire public',
    example: 'Information complémentaire sur la panne en cours — le technicien est sur place.',
    minLength: 1,
    maxLength: 5000,
  })
  @IsString({ message: 'Le contenu est requis.' })
  @MinLength(1, { message: 'Le contenu ne peut pas être vide.' })
  @MaxLength(5000, { message: 'Le contenu ne peut pas dépasser 5000 caractères.' })
  content: string;
}
