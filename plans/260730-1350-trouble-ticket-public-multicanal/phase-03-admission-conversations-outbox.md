# Phase 03 — Admission, conversations, outbox et email

## Statut

- Terminée et commitée.

## Contexte

L’identité publique existe, mais aucun cas d’usage ne doit contourner les règles de ticket, l’historique, le SLA ou l’affectation.

## Vue d’ensemble

Livrer la première tranche verticale sans IA : conversation, formulaire, confirmation, création, suivi, commentaire public, transfert humain et email durable.

## Exigences

- DTO publics distincts, sans priorité, sévérité, département, équipe ou SLA.
- Accès filtré par ticket, demandeur et intégration dans la même requête.
- `support_messages` canonique avant ticket ; `ticket_comments` canonique après ticket.
- SLA démarré à la création confirmée, délai d’admission mesuré séparément.
- Toute mutation externe durable écrit une outbox transactionnelle.
- Une note interne ne peut produire aucun événement externe.

## Architecture

`PublicAdmissionPolicyService` produit une commande interne complète à partir de l’intégration, catégorie, service et matrice impact × urgence. Le service ticket commun l’exécute atomiquement. Un poller PostgreSQL publie ensuite les événements vers BullMQ et les adaptateurs de livraison.

## Étapes

1. Créer `src/modules/public-support/` avec contrôleurs, DTO, policies, accès, conversations, tickets et statuts publics.
2. Exposer les groupes de routes : vérification/session, catalogue, conversations, tickets, timeline, commentaires, transfert et préférences.
3. Implémenter l’état `START → VERIFY → QUALIFY → DRAFT → CONFIRM → CREATED → FOLLOW_UP_OR_HANDOFF`.
4. Refuser la création sans contact vérifié, confirmation ou transfert humain explicite.
5. Appliquer le routage ordonné : intégration, catégorie autorisée, produit/service, impact × urgence, triage par défaut.
6. Appeler la commande ticket transactionnelle ; recopier les champs client comme instantané et lier `requesterId`.
7. Mapper les statuts internes selon la matrice de phase 00 et filtrer la timeline publique à la source.
8. Lors d’un commentaire agent sur ticket public : écrire atomiquement acteur interne, historique, `firstResponseAt` si absent et outbox `PUBLIC_REPLY_CREATED` ; la réponse devient immuable dès soumission.
9. Créer `src/modules/outbox/` avec réservation `FOR UPDATE SKIP LOCKED`, lease, tentatives bornées et reprise après crash ; utiliser l’ID outbox comme `jobId` BullMQ.
10. Créer `external_deliveries` unique par `(outbox_event_id, channel, destination_key)`, claim atomique, lease, reprise et état `DELIVERY_UNKNOWN`.
11. Transmettre une clé fournisseur lorsque supportée, conserver les jobs assez longtemps et documenter le traitement at-least-once.
12. Une correction est un nouveau commentaire lié au précédent ; aucune réponse déjà diffusée n’est supprimée ou écrasée.
13. Ajouter workers et types dans `src/queues/` sans dupliquer les emails internes.
14. Enregistrer la queue `external-delivery` dans `queues.module.ts` et `queues.types.ts`, avec fermeture, healthcheck, Bull Board et tests lifecycle.
15. Ajouter métriques agrégées et traces sans identifiants métier comme labels.
16. Exporter `openapi.public.json` depuis les seuls modules publics et tester l’absence de routes internes, notes, audit et secrets.

## Fichiers centraux

- `src/modules/public-support/services/public-admission-policy.service.ts`
- `src/modules/public-support/services/public-ticket.service.ts`
- `src/modules/public-support/services/public-ticket-access.service.ts`
- `src/modules/public-support/services/public-status-mapper.service.ts`
- `src/modules/outbox/services/outbox.service.ts`
- `src/modules/outbox/services/outbox-publisher.service.ts`
- `src/modules/external-delivery/interfaces/channel-adapter.interface.ts`
- `src/modules/external-delivery/adapters/email-channel.adapter.ts`
- `src/queues/workers/external-delivery.worker.ts`
- `src/queues/queues.module.ts`, `src/queues/queues.types.ts`
- `src/common/health/**`, `src/common/bull-board/**`
- `src/modules/comments/comments.service.ts`

## Todo et tests

- [ ] Admission : ordre, fallback triage et champs interdits ignorés/refusés.
- [ ] IDOR : ticket d’un autre demandeur ou d’une autre intégration.
- [ ] Atomicité : création, historique et outbox.
- [ ] Outbox : concurrence, panne après enqueue, reprise et absence de doublon.
- [ ] Livraison : crash après acceptation fournisseur produit `DELIVERY_UNKNOWN`, jamais un succès inventé.
- [ ] Réponse : immutabilité, correction liée, course avec worker et version réellement envoyée.
- [ ] Coexistence : aucun destinataire interne ne reçoit EventEmitter et outbox pour le même effet.
- [ ] Timeline : aucune note interne, affectation sensible ou audit.
- [ ] SLA : démarrage à confirmation et première réponse par commentaire agent.
- [ ] Email : création, demande d’information, résolution, clôture et réouverture.
- [ ] Jalons complets backend et OpenAPI.

## Critères de succès

- Un contact crée et suit un ticket sans IA.
- Redis indisponible ne perd pas l’événement PostgreSQL.
- Une mutation rejouée ne crée pas de second ticket ; les livraisons sont at-least-once, dédupliquées localement et toute ambiguïté est observable.
- Les routes internes et leurs permissions restent inchangées.
