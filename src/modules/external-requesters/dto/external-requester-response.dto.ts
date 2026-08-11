import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const IDENTITY_TYPES = ['EMAIL', 'PHONE', 'WORDPRESS'] as const;

/** Identité vérifiée sans jamais exposer la valeur (email/téléphone) en clair. */
export class ExternalRequesterIdentityDto {
  @ApiProperty({ enum: IDENTITY_TYPES })
  identityType: string;

  @ApiProperty()
  verifiedAt: Date;

  @ApiPropertyOptional({ nullable: true })
  revokedAt?: Date | null;
}

/** Profil public conservé côté serveur, sans compte interne. */
export class ExternalRequesterListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  supportIntegrationId: string;

  @ApiPropertyOptional({ nullable: true })
  displayName?: string | null;

  @ApiProperty()
  locale: string;

  @ApiPropertyOptional({ nullable: true })
  lastSeenAt?: Date | null;

  @ApiPropertyOptional({ nullable: true, description: 'Date d’anonymisation si le profil a été effacé.' })
  anonymizedAt?: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class ExternalRequesterDetailDto extends ExternalRequesterListItemDto {
  @ApiProperty({ description: 'Synthèse des impacts sans contenu des tickets ni des messages.' })
  summary: {
    tickets: number;
    conversations: number;
    trustedDevices: number;
    identities: ExternalRequesterIdentityDto[];
  };
}
