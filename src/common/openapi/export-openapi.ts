import { writeFile } from 'fs/promises';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../../app.module';
import { AppConfigService } from '../../config/app.config';
import { createOpenApiDocument } from './openapi.config';
import { stableJson } from './stable-json';

async function exportOpenApi(): Promise<void> {
  process.env['OTEL_ENABLED'] = 'false';
  const app = await NestFactory.create(AppModule, { logger: false });
  const config = app.get(AppConfigService);
  app.setGlobalPrefix(config.apiPrefix);

  const outputPath = resolve(process.cwd(), 'openapi.json');
  await writeFile(outputPath, stableJson(createOpenApiDocument(app)), 'utf8');
  process.stdout.write(`OpenAPI exporté vers ${outputPath}\n`);
  await Promise.race([app.close(), new Promise<void>((resolveClose) => setTimeout(resolveClose, 2000))]);
  process.exit(0);
}

exportOpenApi().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Erreur inconnue';
  process.stderr.write(`Échec export OpenAPI: ${message}\n`);
  process.exitCode = 1;
});
