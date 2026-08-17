# Scout — Portail public, widget et intégration WordPress

## Périmètre
Audit lecture seule du backend public, de `public-frontend` et du plugin WordPress `trouble-ticket-connector`.

## Constats vérifiés
- Portail : `src/app/page.tsx`, `src/components/portal/portal-shell.tsx`, `src/app/globals.css`.
- Widget : `src/features/widget/widget-shell.tsx`, `widget-portal.tsx`, `widget-request-form.tsx`, `src/features/conversation/assistant-panel.tsx`.
- Loader : `public/widget/v2/widget.js` ; WordPress l’injecte depuis `inc/widget-renderer.php`.
- Catalogue : `client.ts` appelle `/api/public/catalog`; `public-admission-policy.service.ts` filtre par `allowedCategoryIds`.
- Runtime Compose : une intégration active « PhotoVault local browser recipe », quatre UUID autorisés ; aucun ne correspond aux sept catégories présentes.

## Risques
- Hauteur fixe et `RESIZE` statique sur petits écrans.
- Pied de fallback qui consomme une hauteur permanente.
- Formulaire et bot séparés en écrans, avec parcours moins lisible.
- Données d’intégration obsolètes, cause directe du tableau de catégories vide.

## Hors périmètre initial
Pas de changement de schéma, d’authentification, de CSP, de secrets ou de contrat API sans découverte bloquante.
