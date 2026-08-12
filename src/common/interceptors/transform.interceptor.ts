import { isRecord } from '../utils/helpers';

/**
 * ============================================================================
 * FICHIER : src/common/interceptors/transform.interceptor.ts
 * RÔLE : Intercepteur HTTP responsable de la normalisation du format de réponse Succès.
 * EXPLICATION :
 * Cet intercepteur enveloppe automatiquement le résultat renvoyé par n'importe quel contrôleur REST
 * dans un contrat JSON universel :
 * `{ success: true, statusCode: 200, data: ... }`
 * Il détecte les cas où le contrôleur fournit déjà une enveloppe structurée pour éviter tout double enveloppement.
 * ============================================================================
 */

import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/** Predicat TypeScript vérifiant si une valeur est un objet non nul. */
/**
 * Intercepteur NestJS interceptant les retours de contrôleurs pour harmoniser la réponse HTTP de succès.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, unknown> {
  /**
   * Intercepte le flux de sortie de la requête et transforme les données selon les standards de l'API.
   *
   * @param context Contexte d'exécution de la requête HTTP.
   * @param next Gestionnaire d'appel de la route.
   * @returns Un Observable publiant la réponse HTTP formatée avec `{ success: true, ... }`.
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();
    const statusCode = response.statusCode;

    return next.handle().pipe(
      map((data) => {
        // Si les données sont déjà formatées avec la propriété `success`, retourner telles quelles
        if (isRecord(data) && 'success' in data) {
          return data;
        }

        // Si l'objet retourné contient déjà une propriété `data` explicite (ex: réponse paginée)
        if (isRecord(data) && Object.prototype.hasOwnProperty.call(data, 'data')) {
          return {
            success: true,
            statusCode,
            ...data,
          };
        }

        // Si un message de confirmation est présent dans le retour du service
        if (isRecord(data) && typeof data['message'] === 'string') {
          return { success: true, statusCode, ...data };
        }

        // Enveloppement standard par défaut
        return {
          success: true,
          statusCode,
          data,
        };
      }),
    );
  }
}
