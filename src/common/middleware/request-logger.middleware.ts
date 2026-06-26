import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware qui logue l'entrée de chaque requête HTTP avec Pino.
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('RequestLogger');

  use(req: Request, _res: Response, next: NextFunction): void {
    const correlationId = (req.headers['x-correlation-id'] as string) || 'N/A';

    this.logger.log({
      message: 'Requête entrante',
      method: req.method,
      url: req.originalUrl,
      correlationId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    next();
  }
}
