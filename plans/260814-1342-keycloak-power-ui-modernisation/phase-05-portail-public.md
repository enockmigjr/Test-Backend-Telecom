# Phase 05 — Portail public (style et cohérence de marque)

## Statut
- Prévu — dépend de : D1 (marque), phase 04 (tokens de référence console).
- Références : `public-frontend/` (Next.js 16.2.11, Geist, shadcn/ui, Tailwind v4), `public-frontend/src/components/portal/brand.tsx` (« Assistance Télécom »).

## Contexte
Le portail public n'a aucune mention « Keycloak » visible (vérifié), mais sa marque (« Assistance Télécom ») et ses tokens divergent de la console (« KAMGOKO ITSM », « Operations Desk »). La phase harmonise l'identité et la qualité visuelle sans changer les parcours (bootstrap OTP, demandes, widget).

## Vue d'ensemble
1. Marque unique + logo (D1) sur `brand.tsx`, `portal-shell.tsx`, widget.
2. Alignement des tokens `globals.css` sur la console (valeurs, radius, focus, ombres).
3. Polissage des composants partagés (page-heading, page-state, status) + états vides/erreurs/chargement.
4. Passage a11y et contract/hash.

## Exigences
- Aucune mention « Keycloak » (Gate E) — déjà le cas, à verrouiller par test.
- Marque identique à la console (D1).
- Contrat public inchangé : `contract:check` (hash + génération) vert.
- Light-first ; pas de toggle dark public dans cette phase (YAGNI, réévaluable avec D1).

## Architecture
- **Marque** : `public-frontend/src/components/portal/brand.tsx` adapté (nom D1 + logo), repris par `portal-shell.tsx` et les surfaces widget (`public-frontend/src/features/widget/`).
- **Tokens** : `public-frontend/src/app/globals.css` aligné sur `frontend/src/app/globals.css` (les deux dépôts étant séparés, la duplication de valeurs est assumée et documentée en phase 06).
- **Surfaces** : `page-heading.tsx`, `page-state.tsx`, `status.tsx` harmonisés (espacement, typographie, focus) ; aucun changement de logique métier.

## Étapes
1. Appliquer D1 dans `brand.tsx` (+ composant logo si utile) ; propager dans `portal-shell.tsx` et le widget.
2. Aligner `globals.css` (tokens, focus ring, `color-scheme: light`).
3. Harmoniser `page-heading.tsx`, `page-state.tsx`, `status.tsx` ; vérifier les états chargement/erreur/vide des pages demandes/nouvelle-demande/profil.
4. Vérifier les textes rendus : `rg` « Keycloak » sur `public-frontend/src` + Playwright DOM = 0.
5. Tests : jest colocalisés existants (`public-frontend/src/**/*.test.ts`) + Playwright (`public-frontend/e2e/portal-style.spec.ts` et `public-frontend/e2e/widget-style.spec.ts`, à créer) sur demandes, nouvelle-demande, widget, avec axe ; screenshots.
6. `pnpm verify` + `pnpm contract:check` (hash + diff schema).

## Fichiers
- **Modifier** : `public-frontend/src/components/portal/brand.tsx`, `public-frontend/src/components/portal/portal-shell.tsx`, `public-frontend/src/components/portal/page-heading.tsx`, `public-frontend/src/components/portal/page-state.tsx`, `public-frontend/src/components/portal/status.tsx`, `public-frontend/src/app/globals.css`, surfaces widget concernées.
- **Créer** : composant logo si D1 le demande, `public-frontend/e2e/portal-style.spec.ts`, `public-frontend/e2e/widget-style.spec.ts`, screenshots.

## Todo et tests
- [ ] Marque D1 identique console/portail/widget
- [ ] Zéro « Keycloak » dans le DOM portail (Playwright)
- [ ] Axe : zéro violation AA sur portail + widget
- [ ] États chargement/erreur/vide cohérents (screenshots)
- [ ] `pnpm verify` vert ; `contract:check` vert (hash inchangé sauf si contrat régénéré identique)

## Critères de succès
- Gate E portail atteinte : style sobre cohérent avec la console, marque unique, zéro mention Keycloak, contrat public inchangé.
