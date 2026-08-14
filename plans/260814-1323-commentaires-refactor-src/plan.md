# Plan — Commentaires détaillés et refactor des fichiers source

## Statut
- État : Inventaire terminé, plan en cours d'exécution (validation utilisateur donnée par la demande initiale)
- Design source : `AGENTS.md`, `HARNESS.md`, rapport `plans/reports/review-260814-1600-backend-code-review.md`
- Mode : Difficile (436 fichiers, refactor à comportement strictement identique)
- Dépôts : `Test Backend Telecom` (`cwd`, uniquement `src/**/*.ts`)

## Objectif
Rendre chaque fichier TypeScript du backend compréhensible par un développeur junior (commentaires détaillés en français) et découper les fichiers dépassant 200 lignes à logique dense, sans changer le comportement métier.

## Décisions d'exécution
1. Périmètre : 436 fichiers `src/**/*.ts` (dont 89 spec) ; hors périmètre : `docs/`, `Makefile`, `frontend/`, `public-frontend/`, `keycloak-theme/`, configs infra.
2. Aucune modification de logique métier, de contrat OpenAPI, de signature publique, de DTO ou de requête SQL.
3. Style de commentaires : en-tête `FICHIER / RÔLE / EXPLICATION`, JSDoc par classe/méthode/fonction/interface, commentaires inline « pourquoi » ; tout en français, lignes ≤ 120, Prettier.
4. Refactor : extraction vers de nouveaux fichiers kebab-case < 200 lignes dans le même module ; imports mis à jour ; specs adaptées sans changer les cas testés.
5. WIP préservé : `keycloak-theme/Dockerfile` non committé ; le correctif rôles Keycloak de `jwt.strategy.ts` est committé séparément en `fix(auth)`.
6. Aucun secret : la clé API collée dans la demande n'est ni utilisée, ni committée, ni écrite dans un fichier (révocation conseillée).

## Séquence
1. [Phase 00 — Inventaire et périmètre](./phase-00-inventaire.md)
2. [Phase 01 — Commentaires des 143 fichiers sans commentaire](./phase-01-commentaires-batch-1.md)
3. [Phase 02 — Enrichissement des 293 fichiers déjà commentés](./phase-02-commentaires-batch-2.md)
4. [Phase 03 — Refactor des 36 fichiers > 200 lignes](./phase-03-refactor-200-lignes.md)
5. [Phase 04 — Validation, commits par lot, push et rapport](./phase-04-validation-commits-rapport.md)

## Chemin critique
`Phase 00 → 01 → 02 → 03 → 04` — phases 01/02/03 parallélisables par sous-lots d'agents.

## Gates absolues
- Aucune phase committée sans `pnpm build` et lint (max-warnings=0) verts.
- Aucun changement de logique métier : tests unitaires verts et diff limité aux commentaires/extractions.
- Fichiers créés < 200 lignes ; aucun `*-v2`, `*-enhanced` ; nommage kebab-case.
- Aucun secret ni `.env` dans les diffs/commits.
- Hooks Husky respectés (pas de `--no-verify` sans justification).
- Rapport evidence-led déposé dans `plans/reports/`.

## Décisions requises avant production
- Aucune (travail de maintenabilité uniquement ; les constats de sécurité du rapport du 14/08 restent hors périmètre).

## Preuves de clôture
- Comptage final : fichiers commentés / total, fichiers > 200 lignes restants.
- `git status` propre (hors WIP préservé), commits par lot poussés sur `origin/main`.
- Rapport `plans/reports/review-260814-{heure}-commentaires-refactor-src.md` produit avec l'agent `code-reviewer` et le workflow `/report`.
