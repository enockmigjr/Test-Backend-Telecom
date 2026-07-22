import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class UploadAttachmentDto {
  @ApiPropertyOptional({ description: 'UUID du ticket' })
  @IsOptional()
  @IsUUID('all')
  ticketId?: string;

  @ApiPropertyOptional({ description: 'UUID du commentaire' })
  @IsOptional()
  @IsUUID('all')
  commentId?: string;

  @ApiPropertyOptional({ description: 'UUID de la note interne' })
  @IsOptional()
  @IsUUID('all')
  internalNoteId?: string;
}
