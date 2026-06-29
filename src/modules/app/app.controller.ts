import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Contrôleur racine de l'API.
 * Fournit les informations de base et les health checks.
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

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Health check — liveness' })
  @ApiResponse({ status: 200, description: 'Service en vie.' })
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }

  @Public()
  @Get('test-swagger')
  @ApiOperation({ summary: 'Route de test — vérifie que Swagger détecte les nouvelles routes' })
  @ApiResponse({ status: 200, description: 'Route test fonctionnelle.' })
  testSwagger() {
    return { message: 'Si tu vois cette route dans Swagger, le problème reports est spécifique à ce module.' };
  }
}
