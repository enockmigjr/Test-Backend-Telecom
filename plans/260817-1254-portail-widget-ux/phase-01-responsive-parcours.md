# Phase 01 — Responsive et parcours UX

## Statut

- État : terminée ; build et 8 E2E Chromium vérifiés.

## Vue d’ensemble

Refondre la composition du portail sans changer son identité visuelle : largeur utile adaptative, grille qui respire, navigation mobile exploitable, formulaires hiérarchisés et widget conçu comme une surface autonome.

## Fichiers ciblés

- Modifier `public-frontend/src/app/page.tsx`.
- Modifier `public-frontend/src/components/portal/portal-shell.tsx`.
- Modifier `public-frontend/src/app/globals.css` si nécessaire pour les tokens/layouts.
- Modifier `public-frontend/src/features/widget/widget-shell.tsx`.
- Modifier `public-frontend/src/features/widget/widget-portal.tsx`.
- Modifier `public-frontend/src/features/widget/widget-request-form.tsx`.
- Modifier `public-frontend/src/features/conversation/assistant-panel.tsx`.
- Modifier `public-frontend/public/widget/v2/widget.js` et le miroir v1 uniquement si le comportement partagé l’exige.

## Exigences

- Le contenu occupe la largeur disponible sans max-width global rigide ; les limites restent locales et justifiées.
- Le widget utilise `100dvh`, `svh`/insets si utiles, largeur `min(…)`, et un scroll interne sans élément coupé.
- Le pied « fallback cookies tiers » devient informatif mais compact, sans réserver un espace vide disproportionné.
- Assistant et formulaire sont reliés par une hiérarchie claire : orientation rapide, création guidée, retour accessible.
- États chargement, erreur, vide, reprise, session expirée et catalogue vide explicites.
- Clavier, focus visible, labels et contrastes conservés ou améliorés.

## Tests

- Mettre à jour/ajouter E2E Playwright pour 320×480, 375×667, 768×1024 et desktop.
- Ajouter assertions d’absence de débordement horizontal et de visibilité du bouton final.
- Axe sur accueil, formulaire, widget authentifié et widget formulaire ; suite publique Chromium verte.
