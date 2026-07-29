/**
 * ============================================================================
 * FICHIER : src/modules/tickets/dto/create-ticket.dto.ts
 * RÔLE : DTO de validation pour la création d'un ticket d'incident Télécom.
 * EXPLICATION :
 * Ce DTO valide l'ensemble des données d'ouverture d'un ticket (POST /tickets) :
 * 1. Métadonnées d'incident : `title` (max 255 chars), `description`, `priority` (LOW à CRITICAL), `severity` (S1 à S4).
 * 2. Affectations d'entités : `categoryId` (détermine la politique SLA), `departmentId` (département initiateur) et `assignedTeamId` (équipe technique réceptrice).
 * 3. Informations client optionnelles : `customerAccountNumber`, `customerName`, `customerContact`.
 * 4. Mots-clés de catégorisation : `tags`.
 * ============================================================================
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, IsIn, MaxLength, IsOptional } from 'class-validator';

/** Liste des 4 niveaux de priorité. */
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

/** Liste des 4 niveaux de sévérité télécom. */
const SEVERITIES = ['S1', 'S2', 'S3', 'S4'] as const;

/**
 * Objet DTO de création d'un ticket d'incident télécom.
 */
export class CreateTicketDto {
  /** Titre synthétique de l'incident (max 255 caractères). */
  @ApiProperty({ description: 'Titre du ticket', example: 'Coupure fibre optique secteur Nord' })
  @IsString({ message: 'Le titre du ticket est requis.' })
  @MaxLength(255, { message: 'Le titre ne peut pas dépasser 255 caractères.' })
  title: string;

  /** Description détaillée des symptômes et de l'impact opérationnel. */
  @ApiProperty({
    description: "Description détaillée de l'incident",
    example: 'Absence complète de signal optique pour 150 abonnés.',
  })
  @IsString({ message: 'La description du ticket est requise.' })
  description: string;

  /** Niveau de priorité commerciale et opérationnelle. */
  @ApiProperty({ description: 'Priorité du ticket', enum: PRIORITIES, example: 'HIGH' })
  @IsString()
  @IsIn(PRIORITIES, { message: 'Priorité invalide.' })
  priority: string;

  /** Niveau de sévérité télécom (S1: critique global, S4: mineur). */
  @ApiProperty({ description: 'Sévérité du ticket', enum: SEVERITIES, example: 'S2' })
  @IsString()
  @IsIn(SEVERITIES, { message: 'Sévérité invalide.' })
  severity: string;

  /** Identifiant UUIDv7 de la catégorie d'incident (détermine la politique SLA). */
  @ApiProperty({ description: 'ID de la catégorie', example: '018b3d6f-7e8c-7123-89ab-cdef01234567' })
  @IsUUID('all', { message: "L'ID de la catégorie doit être un UUID valide." })
  categoryId: string;

  /** Identifiant UUIDv7 du département émetteur ou propriétaire du ticket. */
  @ApiProperty({ description: 'ID du département propriétaire', example: '018b3d6f-7e8c-7123-89ab-cdef01234568' })
  @IsUUID('all', { message: "L'ID du département doit être un UUID valide." })
  departmentId: string;

  /** Identifiant UUIDv7 de l'équipe technique chargée de la résolution. */
  @ApiProperty({ description: "ID de l'équipe assignée", example: '018b3d6f-7e8c-7123-89ab-cdef01234569' })
  @IsUUID('all', { message: "L'ID de l'équipe assignée doit être un UUID valide." })
  assignedTeamId: string;

  /** Numéro de compte client impacté (facultatif). */
  @ApiPropertyOptional({ description: 'Numéro de compte client', example: 'CLI-884920' })
  @IsOptional()
  @IsString()
  customerAccountNumber?: string;

  /** Nom ou raison sociale du client impacté (facultatif). */
  @ApiPropertyOptional({ description: 'Nom du client', example: 'Société Telecom SARL' })
  @IsOptional()
  @IsString()
  customerName?: string;

  /** Coordonnées de contact du client (facultatif). */
  @ApiPropertyOptional({ description: 'Contact du client', example: '+33612345678' })
  @IsOptional()
  @IsString()
  customerContact?: string;

  /** Étiquettes et mots-clés de tri (facultatif). */
  @ApiPropertyOptional({ description: 'Tags (mots-clés séparés par des virgules)', example: 'fiber,ftth,outage' })
  @IsOptional()
  @IsString()
  tags?: string;
}
