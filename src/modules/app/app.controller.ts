/**
 * ============================================================================
 * FICHIER : src/modules/app/app.controller.ts
 * RÔLE : Contrôleur racine (`/api/v1`).
 * EXPLICATION :
 * Ce contrôleur répond à la racine de l'API avec une fiche d'information synthétique :
 * le nom du système, la version actuelle, et les adresses vers la documentation Swagger
 * et les bilans de santé.
 * ============================================================================
 */

import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Class AppController
 */
@ApiTags('root')
@Controller()
export class AppController {
  /** Route publique affichant les méta-informations de l'API Telecom */
  @Public()
  @Get()
  @ApiOperation({ summary: "Informations sur l'API" })
  @ApiResponse({ status: 200, description: 'API opérationnelle.' })
  getApiInfo() {
    return {
      name: 'Telecom Ticket Management API',
      version: '1.0.0',
      status: 'operational',
      docs: '/api/docs',
      health: '/api/v1/health',
      metrics: '/api/v1/metrics (Prometheus OpenMetrics)',
    };
  }
}
