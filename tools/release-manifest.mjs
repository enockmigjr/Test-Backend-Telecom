#!/usr/bin/env node
/**
 * Génère le manifeste de release avec le SHA HEAD de chaque dépôt.
 * Usage : node tools/release-manifest.mjs [sortie.json]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(root, '..');

const REPOS = {
  backend: 'D:/Projet-KAMGOKO/Test Backend Telecom',
  frontend: 'D:/Projet-KAMGOKO/Test Backend Telecom/frontend',
  'public-frontend': 'D:/Projet-KAMGOKO/Test Backend Telecom/public-frontend',
  connector: 'C:/xampp/htdocs/site-wordpress1/wp-content/plugins/trouble-ticket-connector',
  photovault: 'C:/xampp/htdocs/site-wordpress1/wp-content/themes/PhotoVault',
};

function sha(path) {
  return execFileSync('git', ['-C', path, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

function version(path) {
  const pkgPath = resolve(path, 'package.json');
  if (!existsSync(pkgPath)) return 'n/a';
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    return pkg.version ?? 'n/a';
  } catch {
    return 'n/a';
  }
}

const repos = Object.fromEntries(
  Object.entries(REPOS).map(([name, path]) => [name, { path, sha: sha(path), version: version(path) }]),
);

const manifest = {
  generatedAt: new Date().toISOString(),
  repos,
  tests: {
    backend: '598 unitaires / 87 suites (hook husky)',
    frontend: '72 tests / 26 suites',
    'public-frontend': '59 tests / 8 suites',
  },
};

const output = resolve(projectRoot, process.argv[2] ?? 'plans/reports/release-manifest-latest.json');
writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Manifeste écrit : ${output}`);
