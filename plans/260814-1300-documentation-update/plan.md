# Plan — Refonte et mise à jour complète de la documentation et du Makefile

## Statut
- État : En cours de cadrage et audit initial
- Mode : Élevé (audit complet, vérifications exactes, suppression références obsolètes, enrichissement ×2)
- Dépôts : `Test Backend Telecom` (`cwd`), `frontend`, `public-frontend`

## Objectif
Mettre à jour de manière exhaustive l'ensemble de la documentation du projet (`README.md`, `Makefile` et 20 fichiers dans `docs/`), supprimer toutes les références aux fichiers nettoyés (`contexte/`, scripts obsolètes, anciens plans), ajouter des explications approfondies (minimum le double de détails) sur l'ensemble des 25 modules et fonctionnalités avancées (Keycloak SSO unique, support public/widget, assertions d'identité, outbox, livraisons sortantes, quarantaine antivirus ClamAV, bot support avec coupe-circuit, base de connaissances), garantir l'exactitude des chiffres (modules, tables, routes, tests, queues, templates), commiter par lot avec push et produire un rapport de clôture evidence-led dans `plans/reports/`.

## Décisions d'exécution
1. Vérification stricte du code source avant toute rédaction (aucun chiffre inventé).
2. Suppression complète de l'ancien modèle auth local (suppression des mentions `POST /api/v1/auth/login`, `PUT /change-password`, `AUTH_PROVIDER=local`) au profit de Keycloak SSO RS256/JWKS unique.
3. Enrichissement massif des flux Mermaid et descriptions techniques dans `docs/` (minimum double de précision).
4. Mise à jour de l'index complet de la documentation au bas du `README.md` avec description exacte de chaque fichier.
5. Mise à jour du `Makefile` (suppression de l'auth locale dans `make accounts`).
6. Validation TypeScript (`typecheck`), OpenAPI (`openapi:export`), lint, commits conventionnels par lot et `git push`.
7. Production d'un rapport complet dans `plans/reports/docs-update-260814-1300-audit-report.md`.

## Séquence
1. [Phase 00 — Audit et inventaire exact des métriques et fichiers](./phase-00-audit-inventaire.md)
2. [Phase 01 — Mise à jour architecture, sécurité et authentification SSO](./phase-01-mise-a-jour-architecture-et-securite.md)
3. [Phase 02 — Mise à jour métier, routes, base de données, SLA et workers](./phase-02-mise-a-jour-operationnelle-et-metier.md)
4. [Phase 03 — Mise à jour guides, devops, observabilité, Makefile et README.md](./phase-03-mise-a-jour-guides-et-manifests.md)
5. [Phase 04 — Validation, commits par lot, push et rapport evidence-led](./phase-04-validation-commits-et-rapport.md)

## Chemin critique
`Phase 00 → Phase 01 → Phase 02 → Phase 03 → Phase 04`

## Gates absolues
- 100% des fichiers `docs/*.md` audités, enrichis et à jour avec les chiffres exacts.
- Aucune référence aux fichiers supprimés (`contexte/`, scripts dev/backup obsolètes, anciens plans) restante.
- Keycloak SSO documenté comme l'unique fournisseur d'authentification.
- `pnpm openapi:export` et `pnpm typecheck` passent sans erreur.
- Commits effectués par lot et poussés sur `origin/main`.

## Preuves de clôture
- Index `README.md` répertoriant tous les 20 fichiers `docs/*.md` à jour.
- `git status` propre et push confirmé sur le dépôt distant.
- Rapport de documentation généré sous `plans/reports/docs-update-260814-1300-audit-report.md`.
