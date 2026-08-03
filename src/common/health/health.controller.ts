/**
 * ============================================================================
 * FICHIER : src/common/health/health.controller.ts
 * RÔLE : Contrôleur de vérification de l'état de santé du serveur (Health Checks).
 * EXPLICATION :
 * Les répartiteurs de charge (Nginx, Kubernetes, Docker) interrogent régulièrement ces 2 routes :
 * 1. `/health` (Liveness) : Vérifie que le serveur backend est démarré et répond.
 * 2. `/health/ready` (Readiness) : Vérifie que la base de données PostgreSQL et Redis sont bien connectées et opérationnelles.
 * ============================================================================
 */

import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Auth, AuthMode } from '../decorators/auth-mode.decorator';
import { HealthService } from './health.service';

/**
 * Class HealthController
 */
@ApiTags('health')
@Controller('health')
@SkipThrottle({ default: true, auth: true })
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /** Route publique `/health` (Test d'activité de l'application) */
  @Auth(AuthMode.ANONYMOUS)
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

  /** Route publique `/health/ready` (Test d'état des dépendances système) */
  @Auth(AuthMode.ANONYMOUS)
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
