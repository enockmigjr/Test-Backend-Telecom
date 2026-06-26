import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

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
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        // Si la donnée contient un message explicite
        if (data && typeof data === 'object' && 'message' in data && 'data' in data) {
          return {
            success: true,
            statusCode,
            message: data['message'],
            data: data['data'],
          };
        }

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
