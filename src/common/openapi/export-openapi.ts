/**
 * ============================================================================
 * FICHIER : src/common/openapi/export-openapi.ts
 * RÔLE : Script CLI d'exportation déterministe du schéma OpenAPI / Swagger au format JSON.
 * EXPLICATION :
 * Ce script est exécuté par la commande `pnpm run openapi:export` pour générer le fichier `openapi.json` :
 * 1. Désactive OpenTelemetry pour ne pas polluer la télémétrie lors de la génération.
 * 2. Instancie l'application NestJS de manière minimale et silencieuse (sans logger HTTP/DB).
 * 3. Génère le document Swagger à partir des métadonnées du contrôleur et le sérialise avec `stableJson`.
 * 4. Écrit la spécification finale dans le fichier `openapi.json` à la racine du projet pour validation CI/CD.
 * ============================================================================
 */

import { writeFile } from 'fs/promises';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../../app.module';
import { AppConfigService } from '../../config/app.config';
import { createOpenApiDocument } from './openapi.config';
import { stableJson } from './stable-json';

/**
 * Fonction asynchrone principale instanciant l'application NestJS et extrayant la spécification OpenAPI.
 */
async function exportOpenApi(): Promise<void> {
  // Désactivation des métriques et du traçage OpenTelemetry pour cette exécution CLI ponctuelle
  process.env['OTEL_ENABLED'] = 'false';

  // Création silencieuse (logger désactivé) de l'application à partir du module racine
  const app = await NestFactory.create(AppModule, { logger: false });

  // Récupération de la configuration pour appliquer le préfixe d'URL (ex: /api/v1) sur le schéma Swagger
  const config = app.get(AppConfigService);
  app.setGlobalPrefix(config.apiPrefix);

  // Génération du document OpenAPI et sérialisation déterministe (tri des clés JSON pour éviter les diffs Git inutiles)
  const outputPath = resolve(process.cwd(), 'openapi.json');
  await writeFile(outputPath, stableJson(createOpenApiDocument(app)), 'utf8');
  process.stdout.write(`OpenAPI exporté vers ${outputPath}\n`);

  // Fermeture propre du contexte d'application NestJS avec un garde de délai d'expiration de 2 secondes
  await Promise.race([app.close(), new Promise<void>((resolveClose) => setTimeout(resolveClose, 2000))]);
  process.exit(0);
}

// Lancement du script et capture d'éventuelles erreurs système
exportOpenApi().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Erreur inconnue';
  process.stderr.write(`Échec export OpenAPI: ${message}\n`);
  process.exitCode = 1;
});
