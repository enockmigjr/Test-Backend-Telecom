import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ description: 'Contenu du commentaire' })
  @IsString({ message: 'Le contenu est requis.' })
  @MinLength(1, { message: 'Le contenu ne peut pas être vide.' })
  content: string;
}
