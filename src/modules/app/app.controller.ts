import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Contrôleur racine de l'API.
 * Fournit les informations de base sur la plateforme.
 * Les health checks sont gérés par HealthController (GET /api/v1/health, /api/v1/health/ready).
 */
@ApiTags('root')
@Controller()
export class AppController {
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
