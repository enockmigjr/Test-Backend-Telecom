/**
 * ============================================================================
 * FICHIER : src/common/interceptors/idempotency.interceptor.ts
 * RÔLE : Intercepteur NestJS pour la transformation des requêtes/réponses.
 * EXPLICATION :
 * Cet intercepteur s'insère dans le cycle de vie des requêtes pour modifier la réponse ou capturer des télémétries.
 * 1. Harmonise la structure globale des réponses HTTP.
 * 2. Enregistre des métriques et des journaux d'exécution.
 * ============================================================================
 */

import { createHash } from 'crypto';
import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { and, eq, gt, lte } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { lastValueFrom, Observable, of } from 'rxjs';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { idempotencyRecords } from '../../database/schemas';
import { IDEMPOTENT_KEY } from '../decorators/idempotent.decorator';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

interface AuthenticatedRequest extends Request {
  user?: { sub?: string; id?: string };
}

interface StoredResponse {
  readonly fingerprint: string;
  readonly statusCode: number | null;
  readonly responseBody: unknown;
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly drizzle: DrizzleProvider,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const enabled = this.reflector.getAllAndOverride<boolean>(IDEMPOTENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!enabled) return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const response = http.getResponse<Response>();
    const rawKey = request.headers['idempotency-key'];
    if (rawKey === undefined) return next.handle();
    if (Array.isArray(rawKey) || !IDEMPOTENCY_KEY_PATTERN.test(rawKey)) {
      throw new BadRequestException('Le header Idempotency-Key est invalide.');
    }

    const userId = request.user?.sub ?? request.user?.id;
    if (!userId) throw new BadRequestException("L'utilisateur authentifié est requis pour l'idempotence.");

    const fingerprint = this.hash(JSON.stringify(request.body ?? null));
    const path = `${request.baseUrl}${request.path}`;
    const keyHash = this.hash(`${userId}:${request.method}:${path}:${rawKey}`);
    await this.drizzle.db.delete(idempotencyRecords).where(lte(idempotencyRecords.expiresAt, new Date()));
    const existing = await this.findStored(keyHash);
    if (existing) return this.replay(existing, fingerprint, response);

    try {
      const body = await this.drizzle.runInTransaction(async () => {
        await this.drizzle.db.insert(idempotencyRecords).values({
          keyHash,
          userId,
          method: request.method,
          path,
          fingerprint,
          expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
        });
        const result = await lastValueFrom(next.handle());
        await this.drizzle.db
          .update(idempotencyRecords)
          .set({ statusCode: response.statusCode, responseBody: result })
          .where(eq(idempotencyRecords.keyHash, keyHash));
        return result;
      });
      return of(body);
    } catch (error: unknown) {
      if (!this.isUniqueViolation(error)) throw error;
      const concurrent = await this.findStored(keyHash);
      if (!concurrent) throw new ConflictException('Une requête identique est déjà en cours de traitement.');
      return this.replay(concurrent, fingerprint, response);
    }
  }

  private async findStored(keyHash: string): Promise<StoredResponse | undefined> {
    const [record] = await this.drizzle.db
      .select({
        fingerprint: idempotencyRecords.fingerprint,
        statusCode: idempotencyRecords.statusCode,
        responseBody: idempotencyRecords.responseBody,
      })
      .from(idempotencyRecords)
      .where(and(eq(idempotencyRecords.keyHash, keyHash), gt(idempotencyRecords.expiresAt, new Date())))
      .limit(1);
    return record;
  }

  private replay(stored: StoredResponse, fingerprint: string, response: Response): Observable<unknown> {
    if (stored.fingerprint !== fingerprint) {
      throw new ConflictException('Cette clé idempotente a déjà été utilisée avec un autre contenu.');
    }
    if (stored.statusCode === null) {
      throw new ConflictException('Une requête identique est déjà en cours de traitement.');
    }
    response.status(stored.statusCode);
    return of(stored.responseBody);
  }

  private isUniqueViolation(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) return false;
    return error.code === '23505' && 'constraint_name' in error && error.constraint_name === 'idempotency_records_pkey';
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
