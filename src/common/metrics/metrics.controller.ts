/**
 * ============================================================================
 * FICHIER : src/common/metrics/metrics.controller.ts
 * RÔLE : Contrôleur d'exposition des métriques système au format OpenMetrics pour Prometheus.
 * EXPLICATION :
 * Ce contrôleur expose le point d'entrée `/api/v1/metrics` interrogé par le serveur de supervision Prometheus :
 * 1. Accès public (`@Public()`) sans authentification par jeton JWT pour autoriser le scraping par l'agent de collecte.
 * 2. Exclus de la limitation de débit (`@SkipThrottle()`) pour éviter les rejets HTTP 429 lors de fréquences de collecte élevées.
 * 3. Définit le type MIME `text/plain; charset=utf-8` conforme au standard OpenMetrics / Prometheus.
 * ============================================================================
 */

import { Controller, Get, Res, Req, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { timingSafeEqual } from 'crypto';
import { Auth, AuthMode } from '../decorators/auth-mode.decorator';
import { MetricsService } from './metrics.service';

/**
 * Contrôleur d'infrastructures pour la collecte de métriques système.
 */
@ApiTags('metrics')
@Controller('metrics')
@SkipThrottle({ default: true, auth: true })
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  /**
   * Endpoint de collecte Prometheus renvoyant l'état des compteurs, jauges et histogrammes de l'application.
   *
   * @param res Objet de réponse Express pour l'injection directe de l'en-tête `Content-Type: text/plain`.
   */
  @Auth(AuthMode.ANONYMOUS)
  @SkipThrottle({ default: true, auth: true })
  @Get()
  @ApiOperation({ summary: 'Métriques Prometheus (format OpenMetrics) — protégé par METRICS_SCRAPE_TOKEN si défini' })
  async metrics(@Req() req: Request, @Res() res: Response): Promise<void> {
    const expected = process.env['METRICS_SCRAPE_TOKEN'];
    if (expected) {
      const auth = req.headers.authorization ?? '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      const ok = token.length === expected.length && timingSafeEqual(Buffer.from(token), Buffer.from(expected));
      if (!ok) throw new UnauthorizedException('Token de scraping invalide.');
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    const metrics = await this.metricsService.getMetrics();
    res.send(metrics);
  }
}
