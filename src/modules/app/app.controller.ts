import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
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
  getApiInfo() {
    return {
      name: 'Telecom Ticket Management API',
      version: '1.0.0',
      status: 'operational',
      docs: '/api/docs',
      health: '/api/v1/health',
      metrics: '/api/v1/metrics',
    };
  }

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Health check — liveness' })
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }

  @Public()
  @Get('metrics')
  @ApiOperation({ summary: 'Métriques Prometheus' })
  metrics() {
    // Stub — sera remplacé par prom-client register.metrics()
    return { status: 'metrics endpoint — prometheus integration pending' };
  }
}
