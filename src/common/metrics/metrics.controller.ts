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

import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { Public } from '../decorators/public.decorator';
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
  @Public()
  @SkipThrottle({ default: true, auth: true })
  @Get()
  @ApiOperation({ summary: 'Métriques Prometheus (format OpenMetrics)' })
  async metrics(@Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    const metrics = await this.metricsService.getMetrics();
    res.send(metrics);
  }
}
