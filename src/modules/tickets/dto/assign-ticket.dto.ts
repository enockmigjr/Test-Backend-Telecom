import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsString, IsOptional } from 'class-validator';

export class AssignTicketDto {
  @ApiProperty({ description: "ID de l'utilisateur cible (UUID)" })
  @IsUUID('all')
  userId: string;

  @ApiPropertyOptional({ description: "Raison de l'assignation" })
  @IsOptional()
  @IsString()
  reason?: string;
}
