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

import { rename, rm, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../../app.module';
import { AppConfigService } from '../../config/app.config';
import { createOpenApiDocument } from './openapi.config';
import { projectPublicOpenApi } from './public-openapi';
import { stableJson } from './stable-json';

interface ContractOutput {
  readonly path: string;
  readonly content: string;
}

async function writeContractSet(outputs: readonly ContractOutput[]): Promise<void> {
  const staged = outputs.map((output) => ({ ...output, temporaryPath: `${output.path}.tmp-${process.pid}` }));
  try {
    await Promise.all(
      staged.map((output) => {
        // Les chemins proviennent uniquement des deux destinations locales fixées par cet exporteur.
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        return writeFile(output.temporaryPath, output.content, 'utf8');
      }),
    );
    await Promise.all(
      staged.map((output) => {
        // Aucune partie de ces chemins ne provient d'une requête ou d'une entrée utilisateur.
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        return rename(output.temporaryPath, output.path);
      }),
    );
  } catch (error: unknown) {
    await Promise.all(staged.map((output) => rm(output.temporaryPath, { force: true })));
    throw error;
  }
}

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
  const document = createOpenApiDocument(app);
  const internalPath = resolve(process.cwd(), 'openapi.json');
  const publicPath = resolve(process.cwd(), 'openapi.public.json');
  await writeContractSet([
    { path: internalPath, content: stableJson(document) },
    { path: publicPath, content: stableJson(projectPublicOpenApi(document)) },
  ]);
  process.stdout.write(`OpenAPI interne exporté vers ${internalPath}\n`);
  process.stdout.write(`OpenAPI public exporté vers ${publicPath}\n`);

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
