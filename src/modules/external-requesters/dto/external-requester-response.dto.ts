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

/** Aperçu des impacts d'une fusion, sans contenu ni valeur d'identité en clair. */
export class MergeRequesterPreviewDto {
  @ApiProperty()
  requesterId: string;

  @ApiProperty({ description: 'Références qui seront rattachées au profil cible.' })
  moved: {
    tickets: number;
    conversations: number;
    messages: number;
    comments: number;
    history: number;
    trustedDevices: number;
    identities: number;
    verificationChallenges: number;
    outboxEvents: number;
    bootstrapGrants: number;
    attachments: number;
  };

  @ApiProperty({
    description: 'Identités vérifiées du profil source (types et dates uniquement, jamais la valeur).',
    type: [ExternalRequesterIdentityDto],
  })
  identities: ExternalRequesterIdentityDto[];

  @ApiProperty({
    description: 'Références conservées telles quelles sur le profil source (historique immuable).',
  })
  kept: {
    auditEntries: number;
    idempotencyRecords: number;
  };
}

export class MergeRequesterResultDto {
  @ApiProperty()
  merged: boolean;

  @ApiProperty()
  targetRequesterId: string;

  @ApiProperty({ type: MergeRequesterPreviewDto })
  moved: MergeRequesterPreviewDto['moved'];

  @ApiProperty()
  identityCollisionsRemoved: number;

  @ApiProperty({ nullable: true })
  displayNameAdopted: string | null;
}

export class RequesterAnonymizedDto {
  @ApiProperty()
  anonymized: boolean;

  @ApiProperty()
  requesterId: string;

  @ApiProperty({ description: 'Déjà anonymisé : aucune donnée supplémentaire n’a été modifiée.' })
  alreadyAnonymized: boolean;
}
