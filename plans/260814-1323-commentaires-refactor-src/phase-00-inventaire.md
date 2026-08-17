# Phase 00 — Inventaire et périmètre

## Statut

- Terminée (14/08/2026 13:23) — lecture seule, aucun fichier modifié.

## Contexte

Avant d'ajouter des commentaires à l'échelle, il faut un inventaire exact : nombre de fichiers, commentaires existants, dépassements de 200 lignes, WIP non committé.

## Constats vérifiés

- [VÉRIFIÉ] 436 fichiers TypeScript sous `src/` (43 711 lignes) — `rg --files src -g "*.ts"`.
- [VÉRIFIÉ] 293 fichiers contiennent déjà un commentaire ; 143 n'en contiennent aucun — `rg -l "^\s*(//|/\*|\*)"`.
- [VÉRIFIÉ] 36 fichiers dépassent 200 lignes ; 21 sont des fichiers de production, 15 des spec — comptage `rg -c "^"`.
- [VÉRIFIÉ] WIP non committé : `keycloak-theme/Dockerfile` (bump Keycloak 26.7.1) et `src/modules/auth/strategies/jwt.strategy.ts` (filtre des rôles métier Keycloak) — `git status`.
- [VÉRIFIÉ] Build baseline vert : `pnpm build` (nest build) sans erreur.
- [VÉRIFIÉ] Hooks Husky actifs : `core.hooksPath=.husky/_` ; pre-commit = lint `--max-warnings=0` + tests.
- [VÉRIFIÉ] `any` restreints aux spec avec `eslint-disable` ; aucun `@ts-ignore`.

## Risques

- Refactor des gros services (tickets, dashboard, reports) sans transaction ni test E2E → validation par build + unitaires + revue humaine des diffs.
- Les commits passent par les hooks : chaque commit lance lint + suite Jest complète (durée élevée, mais obligatoire).

## Fichiers concernés

- Tous les fichiers `src/**/*.ts` (436).
- Aucun fichier hors `src/` ne sera modifié.

## Critères de succès

- [x] Inventaire exact produit (`$env:TEMP\src-inventory.tsv`).
- [x] Périmètre et exclusions actés.
- [x] Baseline build vérifiée.
