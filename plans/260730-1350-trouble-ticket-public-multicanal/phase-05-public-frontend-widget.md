# Phase 05 — Portail public et widget

## Contexte

Le backend public et son OpenAPI sont stables. Le nouveau frontend doit rester indépendant de la console agents et fonctionner en pleine page avant l’intégration iframe.

## Vue d’ensemble

Créer `public-frontend/` comme dépôt Next.js 16 autonome, livrer le portail sans IA, puis le widget iframe et son fallback.

## Statut

En cours. Le gate backend/OpenAPI, le BFF cookie-only, le portail pleine page et le chargeur iframe sont implémentés.
Le temps réel navigateur, les E2E multi-navigateurs et le raccordement Docker/Nginx restent ouverts.

## Exigences

- pnpm, TypeScript strict, aucun `any` et schéma OpenAPI généré.
- BFF même origine, cookies publics HttpOnly et CSRF lié à la session.
- Aucun token dans localStorage ou accessible au chargeur.
- Formulaire classique utilisable à tout moment.
- États chargement, erreur, vide, reprise et hors ligne accessibles.
- Personnalisation bornée par configuration, sans CSS/JS arbitraire.

## Architecture

Le dépôt reprend les patterns éprouvés de `frontend/`, sans importer son code ni partager ses secrets. `widget.js` est un chargeur sans framework ; toute l’application reste dans l’iframe du domaine support.

## Étapes

1. Initialiser le dépôt `public-frontend/` avec Next.js 16, React 19, Tailwind 4, Jest, Playwright, ESLint et scripts pnpm.
2. Ajouter uniquement `contracts/openapi.public.json`, son hash backend et la génération `src/lib/api/schema.d.ts`; ne jamais copier le contrat interne complet.
3. Créer un cookie iframe `Secure; HttpOnly; SameSite=None; Partitioned`, un cookie top-level séparé `Secure; HttpOnly; SameSite=Lax`, et un CSRF synchronizer obtenu par endpoint `no-store` puis gardé en mémoire.
4. Livrer les routes : accueil, demandes, nouvelle demande, détail, profil, appareils et préférences.
5. Créer les features `identity`, `requests`, `timeline`, `attachments`, `preferences` et composants UI partagés.
6. Afficher uniquement les statuts publics et une chronologie filtrée par contrat.
7. Gérer session révoquée, nouvel appareil, lien temporaire, échec de scan et livraison en attente.
8. Ajouter `public/widget.js` avec URL versionnée, intégrité/CSP documentée et aucune logique métier.
9. Créer `/widget`, handshake d’origine, schémas `postMessage` et messages minimaux `READY`, `RESIZE`, `OPEN_PORTAL`, `IDENTITY_ASSERTION`.
10. Construire `frame-ancestors` depuis l’intégration résolue, jamais avec wildcard.
11. Pour ouvrir la pleine page, demander un bootstrap unique, placer le code dans le fragment URL, l’échanger par POST puis appeler `history.replaceState` avant tout chargement tiers.
12. Détecter blocage total des cookies tiers et ouvrir la vérification en top-level ; ne jamais demander Storage Access comme parcours normal.
13. Garantir clavier, lecteur d’écran, focus, responsive et français ; préparer les libellés à l’internationalisation sans plateforme prématurée.
14. Ajouter image, healthcheck et service `public-frontend`, puis configurer Nginx et `docker-compose.yml` seulement lorsque le portail répond réellement.

## Fichiers principaux

- `public-frontend/src/app/(public)/**`
- `public-frontend/src/app/widget/page.tsx`
- `public-frontend/src/app/api/public/[...path]/route.ts`
- `public-frontend/src/lib/api/**`
- `public-frontend/src/lib/auth/**`
- `public-frontend/src/features/widget/origin-handshake.ts`
- `public-frontend/src/features/widget/post-message-schema.ts`
- `public-frontend/src/features/widget/full-page-fallback.ts`
- `public-frontend/public/widget.js`
- `public-frontend/Dockerfile`, `nginx/nginx.conf`, `docker-compose.yml`

## Todo et tests

- [x] Contrat généré sans diff.
- [x] Unitaires : cookies, CSRF, erreurs, statuts, handshake et messages hostiles.
- [ ] E2E portail : vérifier, créer, reprendre, répondre, révoquer et fallback sans bot.
- [ ] E2E Chromium, Firefox, WebKit : iframe, cookies bloqués et pleine page.
- [ ] E2E : cookie partitionné, blocage total, bootstrap unique, rejeu, URL nettoyée et CSRF mémoire.
- [ ] Accessibilité clavier et axe sur parcours critiques.
- [ ] `pnpm lint`, `typecheck`, `test`, `build` réussis ; `test:e2e` reste au jalon navigateur.

## Critères de succès

- Le parcours complet fonctionne en pleine page sans IA ni WordPress.
- Le widget ne peut pas lire les secrets ou données du site hôte.
- Un navigateur sans cookies tiers dispose d’un chemin clair et sûr.
- Aucun endpoint non présent dans OpenAPI n’est appelé.
