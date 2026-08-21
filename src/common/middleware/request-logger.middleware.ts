/**
 * ============================================================================
 * FICHIER : src/common/middleware/request-logger.middleware.ts
 * RÔLE : Middleware NestJS de pré-traitement des requêtes.
 * EXPLICATION :
 * Ce middleware s'exécute sur les requêtes entrantes avant qu'elles n'atteignent les contrôleurs.
 * 1. Injecte des données de contexte (ex: Correlation ID, Request Logger).
 * 2. Effectue des validations ou des transformations préliminaires.
 * ============================================================================
 */

import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware qui logue l'entrée de chaque requête HTTP avec Pino.
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('RequestLogger');

  use(req: Request, _res: Response, next: NextFunction): void {
    const correlationId = (req['correlationId'] as string) || 'N/A';

    this.logger.log({
      message: 'Requête entrante',
      method: req.method,
      url: redactSignature(req.originalUrl),
      correlationId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    next();
  }
}

function redactSignature(rawUrl: string): string {
  const url = new URL(rawUrl, 'http://request.local');
  for (const key of ['signature', 'token', 'code', 'otp', 't', 'expires', 'id']) {
    if (url.searchParams.has(key)) url.searchParams.set(key, '[REDACTED]');
  }
  return `${url.pathname}${url.search}`;
}
