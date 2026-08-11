# Phase 07 — Administration interne enrichie

## Statut

- Backend : routes d'administration posées — lecture SUPERVISOR/ADMINISTRATOR sur les intégrations (y compris appareils et métadonnées de secrets), contrôleur external-deliveries (liste paginée + détail) et module external-requesters (liste + détail avec synthèse d'impacts, jamais de valeur en clair). OpenAPI réexporté (126 opérations) et contrats verts.
- Frontend interne : pages admin à créer (prochaine étape), puis « répondre au demandeur » distinct de la note interne, fusion de profils et rotation.

## Contexte

La compatibilité minimale des acteurs est déjà déployée en phase 01b. Cette phase ajoute les opérations d’administration et l’expérience agent complète.

## Vue d’ensemble

Ajouter l’administration des intégrations, demandeurs et livraisons, puis enrichir les tickets publics sans rouvrir la migration de compatibilité.

## Exigences

- `frontend/` reste son propre dépôt et conserve sa session interne.
- Les types d’acteur sont des unions discriminées, jamais des UUID optionnels ambigus.
- Les permissions internes ne traitent pas un demandeur externe comme propriétaire agent.
- « Répondre au demandeur » et « Note interne » utilisent des routes et intentions distinctes.
- Le frontend interne ne se connecte pas au namespace WebSocket public.
- Secrets jamais lus, affichés ou renvoyés par l’UI.

## Architecture

Le contrat généré décrit l’acteur et les relations nullables. Les adaptateurs Zod transforment les réponses dans les modèles d’affichage. Les actions restent pilotées par la matrice de permissions et les capacités réellement exposées.

## Étapes

1. Réexporter l’OpenAPI backend, mettre à jour le contrat interne et régénérer `schema.d.ts` sans édition manuelle.
2. Créer `features/support-integrations/`, `external-requesters/` et `external-deliveries/` après disponibilité des routes.
3. Créer pages admin intégrations et livraisons ; administrateur pour écriture, superviseur pour lecture autorisée.
4. Ajouter origine, routage, quotas, confiance, fonctions, santé et rotation sans champ secret lisible.
5. Ajouter appareils et fusion explicite de profils avec aperçu des impacts et audit obligatoire.
6. Enrichir `ticket-detail.tsx` : contact vérifié, intégration, canal, handoff et état de livraison.
7. Renommer l’action publique « Répondre au demandeur » et conserver une route distincte de « Note interne ».
8. Rendre une réponse destinée au demandeur immuable ; proposer « Envoyer une correction » liée au message initial, sans hard delete.
9. Adapter les invalidations temps réel internes aux événements persistés sans rejoindre le namespace public.
10. Mettre à jour settings avec des politiques publiques typées, pas des clés/valeurs brutes.

## Fichiers principaux

- `frontend/src/features/tickets/api.ts`
- `frontend/src/features/tickets/ticket-detail.tsx`
- `frontend/src/features/tickets/discussion-panel.tsx`
- `frontend/src/features/realtime/use-realtime-sync.ts`
- `frontend/src/app/(portal)/admin/integrations/page.tsx`
- `frontend/src/app/(portal)/admin/deliveries/page.tsx`

## Todo et tests

- [ ] Contrat interne régénéré sans diff manuel.
- [ ] Aucune note interne dans les modèles ou payloads publics.
- [ ] Réponse publique déclenche historique et livraison ; note interne ne le fait pas.
- [ ] Réponse externe immuable et correction append-only affichée clairement.
- [ ] E2E administration, rotation, révocation et lecture superviseur.
- [ ] `contract:check`, lint, typecheck, tests, build et E2E au jalon.

## Critères de succès

- Les tickets internes historiques s’affichent sans régression.
- Un agent comprend immédiatement l’identité et le canal d’une demande publique.
- Les actions interdites restent absentes et refusées côté serveur.
- Le frontend ne dépend d’aucun champ secret ou route inventée.
