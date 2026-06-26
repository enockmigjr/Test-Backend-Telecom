import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsString, IsOptional } from 'class-validator';

export class EscalateTicketDto {
  @ApiProperty({ description: "ID de l'utilisateur cible (UUID)" })
  @IsUUID('4', { message: "L'ID de l'utilisateur cible doit être un UUID valide." })
  userId: string;

  @ApiProperty({ description: 'ID du département cible (UUID)' })
  @IsUUID('4', { message: "L'ID du département cible doit être un UUID valide." })
  departmentId: string;

  @ApiPropertyOptional({ description: "Raison de l'escalade" })
  @IsOptional()
  @IsString()
  reason?: string;
}
