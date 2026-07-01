import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../decorators/public.decorator';
import { HealthService } from './health.service';

/**
 * Health checks pour Kubernetes/Docker health probes.
 * - /health : liveness (le processus tourne)
 * - /health/ready : readiness (DB + Redis connectés)
 */
@ApiTags('health')
@Controller('health')
@SkipThrottle({ default: true, auth: true })
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @SkipThrottle({ default: true, auth: true })
  @Get()
  @ApiOperation({ summary: 'Liveness check — le processus est-il vivant ?' })
  liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    };
  }

  @Public()
  @SkipThrottle({ default: true, auth: true })
  @Get('ready')
  @ApiOperation({ summary: 'Readiness check — les dépendances sont-elles connectées ?' })
  async readiness() {
    const checks = await this.healthService.check();
    const allHealthy = Object.values(checks).every((c) => c.status === 'ok');

    return {
      status: allHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}
