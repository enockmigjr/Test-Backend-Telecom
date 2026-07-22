# Plan — Frontend ITSM télécom

## Statut

- État : validé, backend prérequis en validation avant implémentation frontend
- Périmètre validé : Release 1 ticketing, temps réel, dashboards, supervision et administration
- Vérité constatée : code, tests et OpenAPI runtime du backend
- Vérité contractuelle cible : OpenAPI fiabilisé et testé en CI

## Objectif

Livrer une console opérationnelle Next.js sobre, rapide, accessible et sécurisée qui expose les capacités réelles du backend sans inventer de routes métier. La Release 1 couvre les opérations tickets, les dashboards, la supervision et l'administration. Les ambitions sans modèle backend restent une roadmap explicite.

## Décisions bloquantes

1. Origine de production commune : Next sur `/`, BFF vers Nest sur `/api/v1`, Socket.IO sur `/ws` via l'edge Nginx.
2. BFF Next avec cookies `__Host-` HttpOnly/Secure/SameSite, contrôle CSRF Origin/Host + jeton et aucun token dans le stockage navigateur.
3. Authentification WebSocket par cookie serveur, origine contrôlée et rooms calculées côté backend.
4. Confirmer que les correctifs backend P0 font partie du chantier avant le frontend sensible.
5. `frontend/` est un dépôt Git indépendant ignoré par le backend, avec CI, Docker et Nginx applicatif séparés.
6. Inclure dans la Release 1 le ticketing opérationnel, les dashboards et les surfaces supervisor/admin supportées.

## Architecture cible

- `frontend/src/app` : routes App Router et layouts.
- `frontend/src/features` : auth, tickets, notifications, dashboard, users, departments, categories, sla, audit, reports, settings.
- `frontend/src/components/ui` : primitives Base UI adaptées au design system.
- `frontend/src/components/domain` : composants métier partagés.
- `frontend/src/lib/api` : contrat généré, client Axios fin, erreurs, query keys.
- `frontend/src/lib/auth`, `permissions`, `realtime`, `observability` : préoccupations transverses.
- URL : filtres, tri, pagination et vue partageables.
- TanStack Query : état serveur interactif; React local : état visuel; Zustand différé jusqu'au workspace multi-panneaux.

## Direction produit

- Light mode, surfaces zinc/blanc, accent bleu retenu, couleurs uniquement fonctionnelles.
- Densité opérationnelle, tables lisibles, rail SLA compact, aucun dashboard décoratif.
- Base UI headless + Tailwind CSS 4; composants construits à partir de besoins prouvés.
- Français en Release 1; structure prête à évoluer sans installer une plateforme i18n prématurée.

## Séquence

1. Gate 0 — décisions, contrat et topologie.
2. Gate 1 — sécurité et contrats backend P0.
3. Phase 2 — walking skeleton frontend réel.
4. Phase 3 — fondations UI émergentes.
5. Phase 4 — Release 1 opérations tickets.
6. Phase 5 — Release 1 supervision et administration.
7. Phase 6 — optimisation mesurée et workspace avancé.
8. Gate 7 — production, sécurité, accessibilité et exploitation.

## Gates absolues

- Aucun code frontend durable avant validation des décisions bloquantes.
- Aucun codegen fiable avant schémas de réponse OpenAPI.
- Aucun écran sensible avant tests négatifs d'isolation backend.
- Aucun composant pour une capacité sans endpoint réel.
- Aucun label « production-ready » tant que les Gates 0, 1 et 7 ne passent pas.

## Documents de phase

- [Gate 0 et Gate 1](./phase-00-contracts-security.md)
- [Walking skeleton et fondations](./phase-01-foundations.md)
- [Release 1 ticketing et temps réel](./phase-02-ticketing-realtime.md)
- [Release 1 supervision et administration](./phase-03-supervision-admin.md)
- [Qualité, production et roadmap](./phase-04-quality-roadmap.md)

## Rapports de décision

- [ADR BFF, session et topologie frontend](./adr-001-bff-session-topology.md)
- [Matrice rôles, pages et actions](../reports/architecture-260720-1128-frontend-permissions.md)
- [Carte des capacités backend](../reports/analysis-260720-1128-frontend-capabilities.md)
- [Registre des gates backend](../reports/security-260720-1128-frontend-backend-gates.md)

## Estimation conditionnelle

- Backend P0 : à estimer après validation du périmètre et des choix auth/WS.
- Release 1 frontend consolidée : estimation à recalibrer après le walking skeleton exécutable.
- Roadmap avancée : estimations séparées, après contrats backend et validation utilisateur.
