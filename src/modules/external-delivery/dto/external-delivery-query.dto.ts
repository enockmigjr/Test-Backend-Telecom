import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

const CHANNELS = ['INTERNAL', 'WEB_PORTAL', 'WIDGET', 'WORDPRESS', 'EMAIL', 'WHATSAPP', 'API'] as const;
const STATUSES = ['PENDING', 'PROCESSING', 'DELIVERED', 'FAILED', 'DELIVERY_UNKNOWN'] as const;

type DeliveryChannel = (typeof CHANNELS)[number];
type DeliveryStatus = (typeof STATUSES)[number];

export class ExternalDeliveryQueryDto {
  @ApiPropertyOptional({ description: 'Filtrer par intégration de support (UUID).' })
  @IsOptional()
  @IsUUID()
  supportIntegrationId?: string;

  @ApiPropertyOptional({ enum: CHANNELS, description: 'Canal de livraison.' })
  @IsOptional()
  @IsIn(CHANNELS)
  channel?: DeliveryChannel;

  @ApiPropertyOptional({ enum: STATUSES, description: 'Statut de livraison.' })
  @IsOptional()
  @IsIn(STATUSES)
  status?: DeliveryStatus;

  @ApiPropertyOptional({ description: 'Numéro de page (commence à 1).', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Éléments par page (max 100).', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
