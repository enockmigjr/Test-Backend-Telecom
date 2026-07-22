import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Intercepteur qui standardise toutes les réponses de succès.
 * Transforme automatiquement le retour des controllers en :
 * { success: true, data: ... } ou { success: true, message: "...", data: ... }
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();
    const statusCode = response.statusCode;

    return next.handle().pipe(
      map((data) => {
        // Si la réponse est déjà au format standard, ne pas la re-wrapper
        if (isRecord(data) && 'success' in data) {
          return data;
        }

        if (isRecord(data) && Object.prototype.hasOwnProperty.call(data, 'data')) {
          return {
            success: true,
            statusCode,
            ...data,
          };
        }

        if (isRecord(data) && typeof data['message'] === 'string') {
          return { success: true, statusCode, ...data };
        }

        // Si la donnée contient un message explicite
        // Format standard
        return {
          success: true,
          statusCode,
          data,
        };
      }),
    );
  }
}
