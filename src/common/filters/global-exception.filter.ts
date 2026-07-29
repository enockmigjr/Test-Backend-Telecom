/**
 * ============================================================================
 * FICHIER : src/common/filters/global-exception.filter.ts
 * RÔLE : Gestionnaire centralisé de toutes les erreurs HTTP du backend NestJS.
 * EXPLICATION :
 * Lorsqu'un problème survient n'importe où dans l'application (base de données inaccessible,
 * mot de passe invalide, champ manquant), ce filtre attrape l'erreur et la transforme
 * en un objet JSON standardisé très propre avec un code d'erreur, un message explicatif,
 * la date et un identifiant unique (correlationId) pour retrouver le problème dans les logs.
 * ============================================================================
 */

import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { ERROR_CODES } from '../constants/error-codes.constant';

/**
 * Filtre d'exception global s'appliquant à toutes les requêtes entrant dans le système.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  /**
   * Méthode principale `catch` interceptant toutes les exceptions non capturées.
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Identifiant unique de requête pour le suivi des requêtes (Traçabilité)
    const correlationId = (request['correlationId'] as string) || generateUuid();

    let status: number;
    let code: string;
    let message: string;
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        const responseMessage = resp['message'];

        if (Array.isArray(responseMessage) && responseMessage.every((item) => typeof item === 'string')) {
          message = 'La validation des données a échoué.';
          details = resp['errors'] ?? resp['details'] ?? { messages: responseMessage };
        } else {
          message = typeof responseMessage === 'string' ? responseMessage : exception.message;
          details = resp['errors'] ?? resp['details'] ?? undefined;
        }

        // Déterminer le code d'erreur standardisé
        code = this.mapHttpStatusToErrorCode(status, resp['code'] as string | undefined);
      } else {
        message = exceptionResponse as string;
        code = this.mapHttpStatusToErrorCode(status);
      }
    } else if (exception instanceof Error) {
      // Erreurs de programmation imprévues (Bugs)
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = ERROR_CODES.INTERNAL_ERROR;
      message = 'Une erreur interne est survenue.';

      this.logger.error(`Erreur non gérée: ${exception.message}`, exception.stack, `correlationId=${correlationId}`);
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = ERROR_CODES.INTERNAL_ERROR;
      message = 'Une erreur inconnue est survenue.';
    }

    // Réponse HTTP uniformisée
    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        details: details || undefined,
        correlationId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Méthode d'aide associant chaque statut HTTP à un code d'erreur compréhensible.
   */
  private mapHttpStatusToErrorCode(status: number, existingCode?: string): string {
    if (existingCode) return existingCode;

    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ERROR_CODES.INVALID_INPUT;
      case HttpStatus.UNAUTHORIZED:
        return ERROR_CODES.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ERROR_CODES.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ERROR_CODES.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ERROR_CODES.CONFLICT;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ERROR_CODES.RATE_LIMIT_EXCEEDED;
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return ERROR_CODES.VALIDATION_ERROR;
      default:
        return ERROR_CODES.INTERNAL_ERROR;
    }
  }
}
