import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import { AsyncLocalStorage } from 'async_hooks';
import { trace, context } from '@opentelemetry/api';

/**
 * Stockage local asynchrone pour propager le correlationId
 * dans tout le contexte d'une requête sans le passer en paramètre.
 */
export const asyncLocalStorage = new AsyncLocalStorage<{ correlationId: string }>();

/**
 * Middleware qui génère ou propage le Correlation ID.
 * - Si le header X-Correlation-Id est présent, il est réutilisé (traçage inter-systèmes).
 * - Sinon, un nouvel UUID est généré.
 * - Le correlationId est ajouté aux headers de réponse, stocké dans AsyncLocalStorage,
 *   et injecté comme attribut sur le span OpenTelemetry actif.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId = (req.headers['x-correlation-id'] as string) || generateUuid();

    // Attacher à la requête
    req['correlationId'] = correlationId;

    // Ajouter aux headers de réponse
    res.setHeader('X-Correlation-Id', correlationId);

    // Injecter dans le span OpenTelemetry actif (traçage Loki ↔ Tempo)
    const activeSpan = trace.getSpan(context.active());
    if (activeSpan) {
      activeSpan.setAttribute('correlation.id', correlationId);
    }

    // Stocker dans AsyncLocalStorage pour accès global
    asyncLocalStorage.run({ correlationId }, () => {
      next();
    });
  }
}
