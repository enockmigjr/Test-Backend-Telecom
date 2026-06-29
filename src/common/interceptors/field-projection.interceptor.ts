import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';

/**
 * Intercepteur de projection de champs.
 * Permet au client de choisir le niveau de détail via le query param `detail`.
 *
 * Usage:
 *   GET /tickets?detail=summary → retourne uniquement les champs essentiels
 *   GET /tickets?detail=full    → retourne tous les champs (+ relations)
 *
 * Appliquer via @UseInterceptors(FieldProjectionInterceptor) sur les routes concernées.
 */

const SUMMARY_FIELDS: Record<string, string[]> = {
  tickets: ['id', 'ticketNumber', 'title', 'status', 'priority', 'severity', 'category', 'assignedTo', 'createdAt'],
  users: ['id', 'email', 'firstName', 'lastName', 'role', 'isActive', 'departmentId'],
  departments: ['id', 'name'],
};

@Injectable()
export class FieldProjectionInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const detail = (request.query['detail'] as string) || 'full';
    const resource = this.detectResource(request.path);

    return next.handle().pipe(
      map((data) => {
        if (detail !== 'summary' || !resource) {
          return data;
        }
        return this.projectFields(data, SUMMARY_FIELDS[resource] || []);
      }),
    );
  }

  private detectResource(path: string): string | null {
    const match = path.match(/\/api\/v1\/([a-z-]+)/);
    return match ? match[1] : null;
  }

  private projectFields(data: unknown, fields: string[]): unknown {
    if (!data || typeof data !== 'object') return data;

    if (Array.isArray(data)) {
      return data.map((item) => this.pickFields(item, fields));
    }

    // Si data.data existe (réponse standard)
    if ('data' in data && typeof (data as Record<string, unknown>)['data'] === 'object') {
      const obj = data as Record<string, unknown>;
      const inner = obj['data'];
      if (Array.isArray(inner)) {
        return { ...obj, data: inner.map((item: object) => this.pickFields(item, fields)) };
      }
      return { ...obj, data: this.pickFields(inner as object, fields) };
    }

    return this.pickFields(data as object, fields);
  }

  private pickFields(obj: object, fields: string[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const field of fields) {
      if (field in obj) {
        result[field] = (obj as Record<string, unknown>)[field];
      }
    }
    return result;
  }
}
