# Phase 02 — Enrichissement des 293 fichiers déjà commentés

## Statut

- À lancer après la phase 01.

## Contexte

293 fichiers ont déjà des commentaires, souvent un en-tête et quelques JSDoc, mais des fonctions, interfaces ou blocs restent non documentés.

## Exigences

- Conserver les commentaires existants ; les enrichir sans les remplacer.
- Compléter : JSDoc manquantes, `@param`/`@returns`/`@throws`, interfaces/type/enum, blocs de logique denses.
- Même style et mêmes interdictions que la phase 01.
- Exclure les fichiers traités en phase 03 pour éviter les conflits (ou les traiter en fin de phase 03).

## Sous-lots

- Par domaine : modules (8 agents), common/database/websocket/queues/config (2 agents).

## Critères de succès

- 100 % des 293 fichiers relus et enrichis.
- Build/lint verts ; diff limité aux commentaires.
