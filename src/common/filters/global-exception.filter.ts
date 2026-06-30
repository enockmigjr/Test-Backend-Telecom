import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { ERROR_CODES } from '../constants/error-codes.constant';

/**
 * Filtre d'exception global qui standardise toutes les réponses d'erreur.
 * Format : { success: false, error: { code, message, details?, correlationId, timestamp } }
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

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
        message = (resp['message'] as string) || exception.message;
        details = resp['errors'] || resp['details'] || undefined;

        // Déterminer le code d'erreur
        code = this.mapHttpStatusToErrorCode(status, resp['code'] as string | undefined);
      } else {
        message = exceptionResponse as string;
        code = this.mapHttpStatusToErrorCode(status);
      }
    } else if (exception instanceof Error) {
      // Erreurs de programmation (bugs imprévus)
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = ERROR_CODES.INTERNAL_ERROR;
      message = 'Une erreur interne est survenue.';

      this.logger.error(`Erreur non gérée: ${exception.message}`, exception.stack, `correlationId=${correlationId}`);
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = ERROR_CODES.INTERNAL_ERROR;
      message = 'Une erreur inconnue est survenue.';
    }

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
