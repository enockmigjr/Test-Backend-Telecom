import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class MergeRequesterDto {
  @ApiProperty({ description: 'Profil cible de la fusion, dans la même intégration.' })
  @IsUUID()
  targetRequesterId: string;
}
