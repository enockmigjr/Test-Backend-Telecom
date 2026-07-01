import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateInternalNoteDto {
  @ApiProperty({
    description: 'Contenu de la note interne (visible uniquement par les équipes autorisées)',
    example: 'Vérification du diagnostic NOC — le problème semble venir du routeur R7.',
    minLength: 1,
  })
  @IsString({ message: 'Le contenu est requis.' })
  @MinLength(1, { message: 'Le contenu ne peut pas être vide.' })
  content: string;
}
