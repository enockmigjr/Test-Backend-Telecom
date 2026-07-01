import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

/**
 * Initialise le SDK OpenTelemetry pour le tracing distribué.
 * Les traces sont exportées vers Tempo via OTLP HTTP.
 *
 * Doit être appelé AVANT NestFactory.create() dans main.ts.
 */
export function initOpenTelemetry(): NodeSDK {
  const traceExporter = new OTLPTraceExporter({
    url: process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] || 'http://localhost:4318/v1/traces',
  });

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [SemanticResourceAttributes.SERVICE_NAME]: process.env['OTEL_SERVICE_NAME'] || 'telecom-api',
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env['OTEL_SERVICE_VERSION'] || '1.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env['NODE_ENV'] || 'development',
    }),
    traceExporter,
    instrumentations: [
      new HttpInstrumentation({
        ignoreIncomingRequestHook: (req) => {
          const url = req.url || '';
          return (
            url.endsWith('/metrics') ||
            url.endsWith('/health') ||
            url.endsWith('/health/ready') ||
            url.includes('/api/v1/metrics') ||
            url.includes('/api/v1/health')
          );
        },
      }),
      new ExpressInstrumentation(),
      new NestInstrumentation(),
      new PgInstrumentation(),
      new IORedisInstrumentation(),
    ],
  });

  sdk.start();
  console.log('OpenTelemetry SDK démarré — traces → Tempo');

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk.shutdown().catch(() => {});
  });

  return sdk;
}
