import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { Public } from '../decorators/public.decorator';
import { MetricsService } from './metrics.service';

@ApiTags('metrics')
@Controller('metrics')
@SkipThrottle()
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Métriques Prometheus (format OpenMetrics)' })
  async metrics(@Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    const metrics = await this.metricsService.getMetrics();
    res.send(metrics);
  }
}
