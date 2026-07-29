/**
 * ============================================================================
 * FICHIER : src/modules/reports/dto/signed-report-download-query.dto.ts
 * RÔLE : DTO de validation pour l'URL signée de téléchargement sécurisé des rapports PDF.
 * EXPLICATION :
 * Ce DTO valide les paramètres d'accès public temporaire aux fichiers PDF générés (GET /reports/download/:id) :
 * 1. `expires` : Horodatage UNIX (en secondes) définissant la limite de validité du lien.
 * 2. `signature` : Empreinte cryptographique HMAC SHA-256 base64url (43 caractères) garantissant l'intégrité et l'authenticité de l'URL.
 * ============================================================================
 */

import { Type } from 'class-transformer';
import { IsInt, Matches, Min } from 'class-validator';

/**
 * DTO des paramètres de requête de téléchargement d'un rapport PDF via un lien signé.
 */
export class SignedReportDownloadQueryDto {
  /** Horodatage UNIX d'expiration du lien temporaire. */
  @Type(() => Number)
  @IsInt({ message: "L'horodatage d'expiration doit être un nombre entier." })
  @Min(1)
  declare expires: number;

  /** Signature cryptographique HMAC SHA-256 au format base64url (43 caractères). */
  @Matches(/^[A-Za-z0-9_-]{43}$/, { message: 'La signature cryptographique du lien est invalide.' })
  declare signature: string;
}
