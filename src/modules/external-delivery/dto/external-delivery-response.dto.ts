import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const CHANNELS = ['INTERNAL', 'WEB_PORTAL', 'WIDGET', 'WORDPRESS', 'EMAIL', 'WHATSAPP', 'API'] as const;
const STATUSES = ['PENDING', 'PROCESSING', 'DELIVERED', 'FAILED', 'DELIVERY_UNKNOWN'] as const;

type DeliveryChannel = (typeof CHANNELS)[number];
type DeliveryStatus = (typeof STATUSES)[number];

/** Livraison externe sans contenu ni secret (administrateur/superviseur). */
export class ExternalDeliveryListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: 'Événement outbox d’origine.' })
  outboxEventId: string;

  @ApiProperty({ description: 'Intégration de support concernée.' })
  supportIntegrationId: string;

  @ApiProperty({ enum: CHANNELS })
  channel: DeliveryChannel;

  @ApiProperty({ description: 'Clé de destination opaque (empreinte, jamais la valeur en clair).' })
  destinationKey: string;

  @ApiProperty({ enum: STATUSES })
  status: DeliveryStatus;

  @ApiProperty()
  attemptCount: number;

  @ApiPropertyOptional({ nullable: true })
  providerMessageId?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Catégorie d’erreur du dernier échec, sans contenu.' })
  lastError?: string | null;

  @ApiPropertyOptional({ nullable: true })
  deliveredAt?: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
