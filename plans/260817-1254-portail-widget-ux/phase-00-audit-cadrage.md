# Phase 00 — Audit et cadrage

## Statut
- État : terminée en lecture seule.
- Preuves : `public-frontend/src/features/widget/widget-shell.tsx`, `public-frontend/public/widget/v2/widget.js`, `src/modules/public-support/services/public-admission-policy.service.ts`, requête PostgreSQL Compose du 17/08/2026.

## Constats vérifiés
1. Le loader impose `height:min(520px,calc(100vh - 112px))`, puis accepte `RESIZE` jusqu’à 760 px.
2. Le shell envoie `620` ou `700` px et réserve un pied permanent au texte de fallback.
3. Le formulaire et l’assistant sont deux écrans distincts du widget.
4. Le catalogue filtre par `routing_policy.allowedCategoryIds`.
5. L’intégration active « PhotoVault local browser recipe » contient quatre UUID absents de `categories`, qui contient sept lignes réelles.

## Risques
- Une correction visuelle peut casser le parcours iframe/cookies tiers ou le focus.
- Un mapping arbitraire de catégories peut router les tickets vers la mauvaise équipe.
- Une simple correction frontend ne résout pas le catalogue vide.

## Critères de sortie
- [x] Flux widget et WordPress tracés.
- [x] Cause racine des catégories vides identifiée.
- [x] Fichiers et contrats concernés listés.
