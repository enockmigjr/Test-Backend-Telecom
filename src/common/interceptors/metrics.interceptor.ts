import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { MetricsService } from '../metrics/metrics.service';

/**
 * Intercepteur qui enregistre les métriques HTTP pour Prometheus.
 * Chaque requête HTTP est comptabilisée et sa durée mesurée.
 *
 * Métriques produites :
 * - telecom_http_requests_total{method, route, status_code}
 * - telecom_http_request_duration_seconds{method, route}
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const startTime = Date.now();

    // Normaliser la route : remplacer les IDs dynamiques par :param
    const route = this.normalizeRoute(request.route?.path || request.url?.split('?')[0] || '/unknown');

    return next.handle().pipe(
      tap({
        next: () => {
          const durationSec = (Date.now() - startTime) / 1000;
          const statusCode = response.statusCode.toString();

          this.metricsService.httpRequestsTotal.inc({ method: request.method, route, status_code: statusCode });
          this.metricsService.httpRequestDuration.observe({ method: request.method, route }, durationSec);
        },
        error: () => {
          const durationSec = (Date.now() - startTime) / 1000;

          this.metricsService.httpRequestsTotal.inc({ method: request.method, route, status_code: '500' });
          this.metricsService.httpRequestDuration.observe({ method: request.method, route }, durationSec);
        },
      }),
    );
  }

  /**
   * Normalise une route en remplaçant les segments dynamiques (UUIDs, nombres)
   * par des placeholders pour éviter une cardinalité infinie.
   */
  private normalizeRoute(route: string): string {
    return (
      route
        // UUIDs → :id
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
        // Nombres seuls → :id
        .replace(/\/\d+(?=\/|$)/g, '/:id')
    );
  }
}
