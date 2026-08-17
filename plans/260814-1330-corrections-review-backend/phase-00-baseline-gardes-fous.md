# Phase 00 — Baseline et garde-fous

## Statut

- Prévu — dépend de rien (première phase)
- Références : `plan.md`, rapports `review-260814-1314` et `review-260814-1600`

## Contexte

Avant tout correctif, il faut une baseline fiable : état des tests, de la compilation et du lint au départ, et des garde-fous automatiques qui empêcheront la régression des règles du dépôt (fichiers < 200 lignes, zéro `any`, zéro `@ts-ignore`).

## Vue d'ensemble

1. Exécuter la suite complète pour établir la baseline (unit + e2e + intégration).
2. Vérifier la compilation et le lint.
3. Ajouter un garde-fou lint/CI sur la taille des fichiers (> 200 lignes → warning bloquant) et sur les interdits (`any`, `@ts-ignore`, non-null assertion).
4. Vérifier l'OpenAPI actuel (export + tests de contrat) pour geler le contrat avant modifications.

## Exigences

- Aucune modification de code métier dans cette phase.
- La baseline doit être reproductible (commandes documentées ci-dessous).

## Étapes

1. `pnpm run build` — compiler.
2. `pnpm run test:unit` — 585 tests / 90 suites attendus (vérifié le 13/08/2026, à re-confirmer).
3. `pnpm run test:e2e` et `pnpm run test:integration` — 24 fichiers E2E/intégration.
4. `pnpm run lint` — relever les warnings existants (sans `--fix` d'abord).
5. `pnpm run openapi:check` — vérifier que les contrats OpenAPI et publics sont synchrones.
6. Créer `plans/reports/review-260814-1330-baseline.md` avec les comptes rendus chiffrés.
7. Ajouter la règle ESLint de taille de fichier (`max-lines: 200`) en `warn` puis en `error` une fois la dette traitée (voir Phase 08) — ou l'activer en `error` avec `exclude` documenté pour les fichiers de seed.
8. Ajouter un script `pnpm run check:quality` qui exécute build + lint + openapi:check en séquence.

## Fichiers

- **Créer** : aucun (hors rapport `plans/reports/`)
- **Modifier** : `.eslintrc.js` (règle `max-lines`), `package.json` (script `check:quality`) — uniquement si la baseline le confirme

## Todo

- [ ] Compilation OK
- [ ] Tests unitaires verts (compte exact rapporté)
- [ ] E2E + intégration verts
- [ ] Lint : zéro erreur nouvelle, liste des warnings existants
- [ ] OpenAPI : contrat gelé (export sans diff)
- [ ] Règle `max-lines` ajoutée (état warn documenté)
- [ ] Script `check:quality` opérationnel
- [ ] Rapport baseline `plans/reports/review-260814-1330-baseline.md` écrit

## Critères de succès

- La baseline chiffrée est écrite dans `plans/reports/review-260814-1330-baseline.md`.
- `pnpm run check:quality` passe (ou échoue uniquement sur la dette déjà listée).
- Aucun fichier de production modifié.
