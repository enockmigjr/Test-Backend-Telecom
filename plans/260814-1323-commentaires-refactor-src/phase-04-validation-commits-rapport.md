# Phase 04 — Validation, commits par lot, push et rapport

## Statut

- À lancer après les phases 01→03.

## Exigences

- `pnpm format` (prettier) puis `pnpm build`, lint sans avertissement, `pnpm test:unit`.
- Revue des diffs : aucun changement de logique, aucun secret.
- Commits conventionnels en français, par unité logique (fix WIP, batch 01, batch 02, refactors, docs).
- Hooks Husky respectés ; push sans force sur `origin/main`.
- Rapport evidence-led `plans/reports/review-260814-{heure}-commentaires-refactor-src.md` via l'agent `code-reviewer` (lecture seule) et le workflow `/report`.

## Preuves de clôture

- Sorties de `pnpm build`, lint, `pnpm test:unit`.
- `git log --oneline` des commits du chantier.
- Comptage final des fichiers commentés et des fichiers > 200 lignes.
- Rapport déposé dans `plans/reports/`.
