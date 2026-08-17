# Plan — Refonte responsive du portail public et du widget

## Statut
- État : implémentation terminée ; tests et rebuild Compose vérifiés.
- Design source : `contexte/phase-1-system-design.md`, `contexte/phase-3-api-design-and-implementation-strategy.md`, contrat public frontend.
- Mode : difficile — audit, red-team, validation utilisateur, tests UI et rebuild.
- Dépôts : backend courant, `public-frontend` et plugin WordPress `trouble-ticket-connector`.

## Objectif
Rendre le portail et le widget plus lisibles, fluides et utilisables sur petits écrans, tout en corrigeant la configuration de catalogue de l’intégration WordPress.

## Décisions d’exécution
1. Conserver les tokens, couleurs, contrats publics, cookies HttpOnly/CSRF et validation d’origine existants.
2. Remplacer la hauteur fixe du widget par un dimensionnement borné par le viewport, avec resize dynamique sûr.
3. Regrouper l’assistant et le formulaire dans un parcours widget cohérent, sans supprimer le fallback formulaire.
4. Corriger les quatre UUID obsolètes de `allowedCategoryIds` vers les catégories réelles identifiées, après sauvegarde/preuve et validation métier de la correspondance.
5. Préserver toutes les modifications Git existantes hors périmètre ; aucun commit global ni reset destructif.

## Séquence
1. [Phase 00 — audit et cadrage](./phase-00-audit-cadrage.md)
2. [Phase 01 — responsive et parcours UX](./phase-01-responsive-parcours.md)
3. [Phase 02 — intégration WordPress et catalogue](./phase-02-wordpress-catalogue.md)
4. [Phase 03 — validation, revue et livraison](./phase-03-validation-livraison.md)

## Chemin critique
`Phase 00 → Phase 01 + Phase 02 → Phase 03` — les contrôles de contrat et sécurité restent transverses.

## Gates absolues
- Aucun endpoint, champ ou état public inventé ; le contrat et le backend restent autoritatifs.
- Aucun changement de cookie, CSP, sandbox ou `postMessage` sans tests de sécurité associés.
- Les catégories ne sont déclarées corrigées qu’après vérification SQL/API et test du connecteur réel.
- Le widget reste entièrement visible à 320 px de large et 480 px de haut, avec scroll interne contrôlé.
- Axe, clavier, lint, typecheck, tests ciblés et build doivent être exécutés ; E2E runtime non exécuté sera signalé comme tel.
- Rebuild et commit seulement après revue finale, preuve des fichiers ciblés et absence de secret.

## Décisions requises avant production
- Aucun blocage restant pour la démonstration locale ; valider visuellement le rendu dans WordPress.

## Preuves de clôture
- Diff limité aux surfaces ciblées, rapport de revue et captures régénérées.
- Migration 0022 appliquée ; quatre catégories réelles sont exposées par l’intégration.
- Lint, typecheck, 59 tests unitaires, contrat, build et 8 E2E Chromium passent.
- Image Compose reconstruite et service `telecom-public-frontend` sain.
