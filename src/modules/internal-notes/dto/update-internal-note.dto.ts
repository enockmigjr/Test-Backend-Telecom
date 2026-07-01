import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class UpdateInternalNoteDto {
  @ApiProperty({
    description: 'Contenu mis à jour de la note interne',
    example: 'Diagnostic confirmé : remplacement du routeur R7 programmé pour ce soir 22h.',
    minLength: 1,
  })
  @IsString({ message: 'Le contenu est requis.' })
  @MinLength(1, { message: 'Le contenu ne peut pas être vide.' })
  content: string;
}
