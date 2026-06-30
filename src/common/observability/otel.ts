import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { SpanProcessor, ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { Context } from '@opentelemetry/api';
import { asyncLocalStorage } from '../middleware/correlation-id.middleware';

/**
 * SpanProcessor personnalisé qui injecte le correlationId
 * comme attribut sur chaque span pour le traçage de bout en bout.
 *
 * Le correlationId est lu depuis l'AsyncLocalStorage, où il a été
 * stocké par le CorrelationIdMiddleware au début de la requête HTTP.
 */
class CorrelationIdSpanProcessor implements SpanProcessor {
  onStart(_span: ReadableSpan, _parentContext: Context): void {
    // Rien à faire au démarrage — le correlationId n'est disponible
    // qu'une fois le middleware exécuté (dans le contexte async).
  }

  onEnd(span: ReadableSpan): void {
    const store = asyncLocalStorage.getStore();
    if (store?.correlationId) {
      span.attributes['correlation.id'] = store.correlationId;
    }
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
}

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
      [SemanticResourceAttributes.SERVICE_NAME]: 'telecom-api',
      [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env['NODE_ENV'] || 'development',
    }),
    traceExporter,
    spanProcessors: [new CorrelationIdSpanProcessor()],
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
      new NestInstrumentation(),
      new PgInstrumentation(),
      new IORedisInstrumentation(),
    ],
  });

  sdk.start();
  console.log('OpenTelemetry SDK démarré — traces → Tempo (correlationId propagé)');

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk.shutdown().catch(() => {});
  });

  return sdk;
}
