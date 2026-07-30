# Phase 00 — Contrats, topologie et invariants

## Contexte

Le backend et le frontend interne fonctionnent déjà en production logique. La première phase fixe les frontières avant toute migration ou création d’écran.

## Vue d’ensemble

Établir les contrats d’acteur, de statut, de session, de canal et de déploiement. Réserver la frontière du futur dépôt public sans l’initialiser avant la stabilisation de l’OpenAPI public.

## Exigences

- NestJS reste réseau-privé derrière les BFF et Nginx.
- Les quatre dépôts gardent des historiques Git séparés.
- Le numéro visible du ticket n’autorise aucun accès.
- Le formulaire public fonctionne sans IA.
- Les champs client historiques restent un instantané au moment de la création ; `requesterId` porte l’identité courante.

## Architecture

- Backend : source des règles, données, OpenAPI et événements.
- Frontend interne : BFF et session internes inchangés.
- `public-frontend/` : BFF et session publics distincts, portail et iframe.
- WordPress : connecteur et assertion seulement.
- Un manifest de release associe les SHA des dépôts compatibles.

## Étapes

1. Réexporter `openapi.json` et enregistrer le nombre réel d’opérations sans constante inventée.
2. Définir deux artefacts déterministes issus du même backend : `openapi.json` complet et `openapi.public.json` limité aux modules publics.
3. Documenter l’union d’acteur et la matrice statut interne → public :
   - `NEW`, `ASSIGNED` → `RECEIVED` ;
   - `IN_PROGRESS`, `REOPENED`, `PENDING_THIRD_PARTY` → `IN_PROGRESS` ;
   - `PENDING_CUSTOMER` → `WAITING_FOR_CUSTOMER` ;
   - `RESOLVED` → `RESOLVED` ;
   - `CLOSED`, `CANCELLED` → `CLOSED`, avec motif public sûr.
4. Définir les événements publics, leurs versions et leurs clés d’idempotence.
5. Définir la topologie Nginx : domaine support → BFF public → NestJS privé ; `/ws` interne séparé de `/public-support`.
6. Fixer les noms de cookies, audiences et clés : aucune valeur partagée avec l’auth interne.
7. Ajouter `public-frontend/` à `.gitignore` et documenter sa frontière ; son initialisation appartient à la phase 05, après export du contrat public.
8. Définir la matrice RBAC : administrateur gère intégrations/secrets ; superviseur consulte livraisons et demandeurs selon permission ; agents répondent aux tickets visibles.
9. Créer une liste de décisions de production : origines, rétention, clé maître, ClamAV, email/SMS, fournisseur IA.

## Fichiers

- Modifier : `.gitignore`, `openapi.json` après export contrôlé.
- Créer à partir du backend : `openapi.public.json` et son test d’absence de routes internes, notes, audit et secrets.
- Créer : `docs/architecture/public-support-contracts.md`, `docs/operations/public-support-release-manifest.md`.
- Phase ultérieure : `public-frontend/package.json`, `public-frontend/.env.example`, `public-frontend/README.md`.

## Todo

- [x] Contrats et matrice de statuts approuvés.
- [x] Topologie et limites réseau documentées.
- [x] Décisions de production assignées à un rôle responsable.
- [x] Snapshot OpenAPI actuel vérifié.
- [x] Projection publique déterministe et hashable définie.

## Critères de succès

- Aucun endpoint ou champ frontend n’est inventé.
- Les frontières de cookies, audiences, origines et dépôts sont explicites.
- Les décisions encore métier bloquent seulement l’activation production, pas les fondations.

## État d’exécution

- Contrat interne : 83 opérations, hash inchangé.
- Contrat public : 0 opération, projection opt-in sans composant interne.
- Validations : ESLint ciblé, TypeScript strict, projection 3 tests et contrats 7 tests réussis.
- Revues indépendantes : aucun P0/P1 restant.
- Clôture Git : artefacts inclus dans le commit de phase 00.
