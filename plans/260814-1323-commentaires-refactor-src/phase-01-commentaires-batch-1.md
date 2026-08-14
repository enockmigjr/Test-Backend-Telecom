# Phase 01 — Commentaires des 143 fichiers sans commentaire

## Statut
- En cours — exécution par sous-lots d'agents parallèles.

## Contexte
143 fichiers n'ont aucun commentaire : DTO, services publics, sécurité, intégrations, workers. Ce sont les cibles prioritaires pour un développeur junior.

## Exigences
- Ajouter l'en-tête `FICHIER / RÔLE / EXPLICATION` en tête de chaque fichier.
- JSDoc pour chaque classe, méthode publique, fonction, interface, type, enum et membre important.
- Commentaires inline uniquement pour le « pourquoi » (pas de paraphrase du code).
- Ne modifier ni logique, ni signature, ni import, ni test.
- Lancer `pnpm exec prettier --write` sur les fichiers traités.
- Ne pas refactorer les fichiers > 200 lignes ici (phase 03) ; les signaler seulement.

## Sous-lots
- 1A : `src/modules/external-identity/**` (32 fichiers)
- 1B : `src/modules/public-support/**` (28 fichiers)
- 1C : `src/modules/support-integrations/**`, `external-requesters/**`, `outbox/**`, `external-delivery/**` (28 fichiers)
- 1D : `src/modules/attachments/**`, `support-knowledge/**`, `support-bot/**` (28 fichiers)
- 1E : `src/modules/auth/**`, `tickets/**` (hors gros fichiers), `comments/**`, `email/**`, `support-satisfaction/**`, `websocket/**`, `queues/workers/**` (16 fichiers)
- 1F : `src/config/**`, `src/common/**`, `src/database/**` (10 fichiers)

## Critères de succès
- 143/143 fichiers avec commentaires détaillés.
- `pnpm build` vert, lint vert.
- Aucune modification de comportement (diff = commentaires uniquement).
