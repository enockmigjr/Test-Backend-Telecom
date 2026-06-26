import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

/**
 * Intercepteur de journalisation qui logue chaque requête entrante et sortante
 * avec le temps de réponse et le statut HTTP.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url } = request;
    const correlationId = (request.headers['x-correlation-id'] as string) || 'N/A';
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const duration = Date.now() - startTime;

          this.logger.log({
            message: 'Requête complétée',
            method,
            url,
            statusCode: response.statusCode,
            durationMs: duration,
            correlationId,
          });
        },
        error: (error) => {
          const duration = Date.now() - startTime;

          this.logger.error({
            message: 'Requête en erreur',
            method,
            url,
            durationMs: duration,
            correlationId,
            error: error.message,
          });
        },
      }),
    );
  }
}
