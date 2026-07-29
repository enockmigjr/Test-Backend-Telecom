/**
 * ============================================================================
 * FICHIER : src/modules/tickets/dto/search-tickets.dto.ts
 * RÔLE : DTO de validation pour la recherche, le filtrage et la pagination des tickets d'incidents.
 * EXPLICATION :
 * Ce DTO hérite de `PaginationDto` et permet de filtrer la liste des tickets d'incidents (GET /tickets) :
 * 1. Filtrage par statut (9 statuts), priorité (4 niveaux) et sévérité (S1 à S4).
 * 2. Filtrage par relations : catégorie, agent assigné, équipe assignée et département.
 * 3. Recherche textuelle globale (`search`) portant sur le numéro de ticket, le titre, la description et le client.
 * 4. Filtrage temporel (`from` / `to` en ISO-8601) et options de tri multi-critères (`sort` & `order`).
 * ============================================================================
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsISO8601, IsIn, MaxLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/** Énumération des 9 statuts de la machine à états des tickets. */
const TICKET_STATUSES = [
  'NEW',
  'ASSIGNED',
  'IN_PROGRESS',
  'PENDING_CUSTOMER',
  'PENDING_THIRD_PARTY',
  'RESOLVED',
  'CLOSED',
  'REOPENED',
  'CANCELLED',
] as const;

/** Énumération des 4 niveaux de priorité. */
const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

/** Énumération des 4 niveaux de sévérité télécom. */
const TICKET_SEVERITIES = ['S1', 'S2', 'S3', 'S4'] as const;

/**
 * DTO de recherche et de filtrage multi-critères des tickets d'incidents.
 */
export class SearchTicketsDto extends PaginationDto {
  /** Filtrer par un statut spécifique de la machine à états. */
  @ApiPropertyOptional({
    description: 'Filtrer par statut',
    enum: TICKET_STATUSES,
  })
  @IsOptional()
  @IsString()
  @IsIn(TICKET_STATUSES, { message: 'Statut de ticket invalide.' })
  status?: (typeof TICKET_STATUSES)[number];

  /** Filtrer par priorité (LOW, MEDIUM, HIGH, CRITICAL). */
  @ApiPropertyOptional({ description: 'Filtrer par priorité', enum: TICKET_PRIORITIES })
  @IsOptional()
  @IsString()
  @IsIn(TICKET_PRIORITIES, { message: 'Priorité invalide.' })
  priority?: (typeof TICKET_PRIORITIES)[number];

  /** Filtrer par niveau de sévérité télécom (S1, S2, S3, S4). */
  @ApiPropertyOptional({ description: 'Filtrer par sévérité', enum: TICKET_SEVERITIES })
  @IsOptional()
  @IsString()
  @IsIn(TICKET_SEVERITIES, { message: 'Sévérité invalide.' })
  severity?: (typeof TICKET_SEVERITIES)[number];

  /** Filtrer par identifiant UUID de catégorie d'incident. */
  @ApiPropertyOptional({ description: 'Filtrer par catégorie (UUID)' })
  @IsOptional()
  @IsUUID('all', { message: "L'identifiant de la catégorie doit être un UUID valide." })
  categoryId?: string;

  /** Filtrer par identifiant UUID de l'agent assigné. */
  @ApiPropertyOptional({ description: 'Filtrer par agent assigné (UUID)' })
  @IsOptional()
  @IsUUID('all', { message: "L'identifiant de l'agent assigné doit être un UUID valide." })
  assignedTo?: string;

  /** Filtrer par identifiant UUID de l'équipe assignée. */
  @ApiPropertyOptional({ description: 'Filtrer par équipe assignée (UUID)' })
  @IsOptional()
  @IsUUID('all', { message: "L'identifiant de l'équipe doit être un UUID valide." })
  assignedTeam?: string;

  /** Filtrer par identifiant UUID du département propriétaire. */
  @ApiPropertyOptional({ description: 'Filtrer par département propriétaire (UUID)' })
  @IsOptional()
  @IsUUID('all', { message: "L'identifiant du département doit être un UUID valide." })
  departmentId?: string;

  /** Recherche textuelle partielle dans le titre, la description, le numéro de ticket ou le nom client. */
  @ApiPropertyOptional({ description: 'Recherche texte (titre, description, numéro, client)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  /** Date de début de plage de création (format ISO 8601). */
  @ApiPropertyOptional({ description: 'Date de début (ISO 8601)' })
  @IsOptional()
  @IsISO8601({}, { message: 'La date de début doit être au format ISO 8601.' })
  from?: string;

  /** Date de fin de plage de création (format ISO 8601). */
  @ApiPropertyOptional({ description: 'Date de fin (ISO 8601)' })
  @IsOptional()
  @IsISO8601({}, { message: 'La date de fin doit être au format ISO 8601.' })
  to?: string;

  /** Champ de tri principal. */
  @ApiPropertyOptional({ enum: ['createdAt', 'updatedAt', 'priority', 'severity', 'status', 'ticketNumber'] })
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'priority', 'severity', 'status', 'ticketNumber'])
  declare sort?: 'createdAt' | 'updatedAt' | 'priority' | 'severity' | 'status' | 'ticketNumber';

  /** Sens du tri (ascendant ou descendant). */
  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  declare order?: 'asc' | 'desc';
}
