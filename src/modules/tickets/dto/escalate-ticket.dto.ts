import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsString, IsOptional } from 'class-validator';

export class EscalateTicketDto {
  @ApiProperty({ description: "ID de l'utilisateur cible (UUID)" })
  @IsUUID('all')
  userId: string;

  @ApiProperty({ description: 'ID du département cible (UUID)' })
  @IsUUID('all')
  departmentId: string;

  @ApiPropertyOptional({ description: "Raison de l'escalade" })
  @IsOptional()
  @IsString()
  reason?: string;
}
