# Phase 01 — Correctifs déjà livrés et vérifiés

## Objectif

Consigner les correctifs déjà commités/poussés pour ce plan, avec leurs preuves, afin de ne pas les refaire.

## Workflow réalisé

1. **Commentaires 500 (point 7)** — cause : `toTicketActorColumns()` renvoie `userId` alors que `ticket_comments` attend `authorId` (et `attachments` attend `uploadedBy`) → `authorId NULL` → violation `ticket_comments_actor_variant_check`. Corrigé dans `comments.service.ts` et `attachments.service.ts` + test de régression. Vérifié live : POST commentaire → 201 (ticket public et interne).
2. **Modals Intégrations (point 8)** — `ResourceDialog` passé en flex avec zone de défilement fiable (`flex-1 min-h-0 overflow-y-auto`), en-tête fixe.
3. **Responsivité bot/portail (point 6)** — widget : scroll interne (`h-full overflow-y-auto`) ; portail : colonnes grille `minmax(0,1fr)` (accueil, coque, détail ticket).
4. **Statistiques support public (point 9)** — endpoint `GET /api/v1/dashboard/public-support` (conversations, demandeurs, messages, tickets publics, délai 1re réponse, canaux) + bloc « Support public » au Dashboard. Vérifié live.
5. **Performance agents (point 1)** — endpoint `GET /api/v1/dashboard/agent-performance` (ouverts, critiques, en retard, à risque, résolus période, SLA dépassés, délai moyen, dernière activité) + tableau au Dashboard. Vérifié live.
6. **Makefile DevOps (point 10, base)** — `Makefile` racine (env/up/down/build/restart/logs/ps/migrate/seed/db-reset/test/lint/typecheck/openapi/db-shell/redis-shell/clean protégé).
7. **Config admin (point 3)** — pondération de charge par département (UI + OpenAPI `Record<string, number>`), algo, auto-assignation, charge max, rôles multiples par catégorie, pause/absence utilisateur (isAvailable/absenceEndsAt).

## Fichiers principaux

- `src/modules/comments/comments.service.ts`, `src/modules/attachments/attachments.service.ts`
- `frontend/src/components/ui/resource-dialog.tsx`
- `public-frontend/src/features/widget/widget-shell.tsx`, `public-frontend/src/app/page.tsx`, `public-frontend/src/components/portal/portal-shell.tsx`
- `src/modules/dashboard/public-support-stats.service.ts`, `src/modules/dashboard/dashboard.service.ts`
- `Makefile`
- `frontend/src/features/departments/*`, `frontend/src/features/dashboard/*`

## Critères de validation (atteints)

- 608 tests backend au vert, lint/typecheck frontend et portail au vert.
- Vérifications live sur Docker : commentaire 201, `public-support` et `agent-performance` renvoient des données cohérentes.
- Commits poussés : backend `d8dd078`, frontend `1a2a2f8`, portail `c027284`.

## Tests

- Régression commentaire : `src/modules/comments/comments.service.spec.ts` (« cree un commentaire interne avec l auteur mappe sur authorId »).
- Contrat OpenAPI : `src/common/openapi/openapi.contract.spec.ts` (138 opérations).
- Suites complètes au jalon 1 : `pnpm test:all` backend, `pnpm test` frontend/portail.
