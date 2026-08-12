/**
 * DTO de mise en pause/reprise volontaire d'un agent (self-service).
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetAvailabilityDto {
  /** false = pause, true = reprise. */
  @ApiProperty({ description: 'Disponibilité (false = pause, true = reprise)', example: false })
  @IsBoolean({ message: 'La disponibilité doit être un booléen.' })
  available: boolean;
}
