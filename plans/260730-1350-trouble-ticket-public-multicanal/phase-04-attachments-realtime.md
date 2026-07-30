# Phase 04 — Pièces jointes et temps réel public

## Contexte

Les fichiers et le WebSocket actuels sont sécurisés pour les agents internes, pas pour une surface publique exposée au spam et aux navigateurs tiers.

## Vue d’ensemble

Ajouter une chaîne réelle de quarantaine/analyse et un namespace temps réel public distinct, avec polling comme solution de secours.

## Exigences

- Aucune confiance dans extension ou MIME déclaré.
- Aucun téléchargement avant état `CLEAN`.
- Aucun faux scanner ou succès simulé.
- Namespace, audience, rooms et CORS séparés de `/ws`.
- Le temps réel est une optimisation ; les données persistées restent autoritatives.

## Architecture

L’upload écrit le fichier en zone de quarantaine et une métadonnée `QUARANTINED`, puis publie un travail de scan. Le scanner contrôle signature réelle et antivirus avant déplacement vers le stockage servi. Le gateway public authentifie le principal public et rejoint uniquement les rooms calculées côté serveur.

## Étapes

1. Étendre `attachment-upload.config.ts` avec quotas publics par intégration et type autorisé.
2. Stabiliser `storage.interface.ts` pour quarantaine, promotion propre et suppression.
3. Faire un spike CommonJS/Jest/build sur `file-type`, puis épingler seulement une version ou un import réellement compatible.
4. Ajouter `attachment-content-inspector.service.ts` après ce spike, sans fallback basé uniquement sur l’extension.
5. Ajouter `antivirus-scanner.interface.ts` et un adaptateur clamd réel : protocole INSTREAM, timeout, taille maximale, healthcheck et fail-closed.
6. Ajouter `attachment-scan.worker.ts`, transitions atomiques et nettoyage des quarantaines expirées.
7. Enregistrer uniquement la queue de scan dans `queues.module.ts` et `queues.types.ts`, avec fermeture, health, Bull Board et tests lifecycle ; la queue livraison est déjà en phase 03.
8. Refuser ou laisser la fonction désactivée si ClamAV est indisponible selon la politique de l’intégration.
9. Ajouter routes publiques d’upload, état et téléchargement, protégées par l’accès triple.
10. Résoudre l’autorisation depuis l’unique parent canonique ; refuser toute ligne multi-parent et toute association publique à une note interne.
11. Les fichiers pré-ticket restent liés au support message ; une matérialisation en commentaire remplace le parent dans une seule transaction, jamais avec deux parents.
12. Créer `public-support.gateway.ts`, `public-websocket-auth.service.ts`, `public-websocket-cors.ts` et module dédié.
13. Utiliser le namespace `/public-support` et des rooms demandeur/conversation calculées côté serveur.
14. Publier seulement des événements de rafraîchissement publics après persistance ; aucune donnée sensible dans le payload.
15. Documenter le polling conditionnel lorsque WebSocket ou cookies tiers échouent.

## Fichiers principaux

- `src/modules/attachments/attachments.service.ts`
- `src/modules/attachments/storage/storage.interface.ts`
- `src/modules/attachments/storage/local-storage.service.ts`
- `src/modules/attachments/security/attachment-content-inspector.service.ts`
- `src/modules/attachments/security/clamav-scanner.service.ts`
- `src/queues/workers/attachment-scan.worker.ts`
- `src/queues/queues.module.ts`, `src/queues/queues.types.ts`
- `src/common/health/**`, `src/common/bull-board/**`
- `src/websocket/public-support.gateway.ts`
- `src/websocket/public-websocket-auth.service.ts`
- `src/websocket/public-websocket-cors.ts`
- `docker-compose.yml`, `.env.example`

## Todo et tests

- [ ] Fichier déguisé, archive interdite, dépassement de taille et contenu malveillant.
- [ ] Aucun accès durant quarantaine ou après rejet.
- [ ] Parent XOR : combinaisons multi-parent et `internalNoteId + supportMessageId` refusées.
- [ ] Compatibilité `file-type` démontrée par Jest et build CommonJS.
- [ ] Queue : enregistrement, fermeture, healthcheck et Bull Board.
- [ ] Nettoyage et reprise après panne du worker.
- [ ] Connexion WebSocket avec session expirée, origine hostile et room forgée.
- [ ] Isolation entre demandeurs et intégrations.
- [ ] Polling fonctionnel sans WebSocket.

## Critères de succès

- Un fichier public n’est visible qu’après inspection et scan réels.
- Le gateway interne ne connaît aucun principal public.
- Une panne de temps réel n’empêche ni consultation ni réponse.
- Les pièces jointes de notes internes restent inaccessibles.
