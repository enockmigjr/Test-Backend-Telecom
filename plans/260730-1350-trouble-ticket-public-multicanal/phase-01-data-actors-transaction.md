# Phase 01 — Données, acteurs et transaction métier

## Contexte

Les tables et services actuels supposent un utilisateur interne. Une migration additive doit précéder toute route publique.

## Vue d’ensemble

Ajouter les entités publiques, introduire l’acteur discriminé et rendre la création ticket/historique/outbox atomique, sans casser les lecteurs internes.

## Exigences

- Aucun faux utilisateur pour `SYSTEM` ou le demandeur.
- Colonnes historiques conservées pendant la double compatibilité.
- Ticket, historique et tout événement outbox demandé dans une même transaction.
- Les commentaires restent canoniques après création du ticket.
- Toutes les nouvelles tables sont indexées par intégration et sujet d’accès.

## Architecture

`TicketActor` est une union stricte : utilisateur interne, demandeur externe ou système. Les colonnes correspondantes sont mutuellement exclusives par `CHECK`. Les `CHECK` sont ajoutés non validés, puis validés en phase 09.

## Étapes

1. Créer les schémas :
   - `support-integrations.ts`, `integration-credentials.ts` ;
   - `external-requesters.ts`, `external-identities.ts`, `external-verification-challenges.ts` ;
   - `trusted-devices.ts`, `support-conversations.ts`, `support-messages.ts` ;
   - `outbox-events.ts`, `external-deliveries.ts`.
2. Étendre `enums.ts`, `tickets.ts`, `ticket-comments.ts`, `ticket-history.ts`, `attachments.ts`, `audit-logs.ts`, `ticket-assignments.ts`, `idempotency-records.ts` et `index.ts`.
3. Ajouter à `tickets` : `openedByUserId`, `requesterId`, `supportIntegrationId`, `sourceChannel`, conserver `createdBy` mais exécuter `DROP NOT NULL` sur `created_by`.
4. Pour commentaires, historique, pièces jointes et audit : ajouter `actorType` et `externalRequesterId`, puis lever `NOT NULL` sur `author_id`, `user_id` et `uploaded_by` internes.
5. Pour affectations : ajouter un acteur limité à `INTERNAL | SYSTEM`, puis lever `NOT NULL` sur `assigned_by` afin d’éliminer le faux administrateur système.
6. Ajouter dès l’expand des `CHECK NOT VALID` : variante acteur exacte ; ticket ouvert par interne, demandeur ou les deux ; `num_nonnulls(ticket_id, comment_id, internal_note_id, support_message_id) = 1` pour une pièce jointe.
7. Lier `support_messages` à `ticket_comments` après création sans recopier le contenu ; ajouter `supportMessageId` et l’état de scan aux pièces jointes antérieures au ticket.
8. Générer `0004_trouble-ticket-public-expand.sql` et son snapshot ; vérifier manuellement `DROP NOT NULL`, contraintes, index, cascades et données sensibles.
9. Créer `ticket-actor.ts` et les fonctions de validation sans cast non vérifié.
10. Étendre `DrizzleProvider.runInTransaction()` pour réutiliser une transaction déjà active et conserver `afterCommit()`.
11. Transformer `TicketsService.create()` en adaptateur vers une commande transactionnelle commune qui accepte explicitement zéro ou plusieurs événements outbox.
12. Backfiller `opened_by_user_id = created_by` et `actor_type = INTERNAL` via `0005_trouble-ticket-actor-backfill.sql`.
13. Activer double lecture/écriture dans tickets, historique, commentaires, pièces jointes, affectations et audit.
14. Propager l’acteur typé dans `ticket.events.ts`, listeners notification/audit/SLA/assignment, workers, rapports, seeds, factories et permissions.
15. Remplacer les faux administrateurs des actions automatiques par l’acteur `SYSTEM`.
16. Adapter l’idempotence à un sujet discriminé sans exiger `request.user.sub`.
17. Tant que l’externe est désactivé, le chemin interne passe zéro événement outbox et conserve EventEmitter ; aucune notification n’est doublée.

## Fichiers métier principaux

- `src/database/drizzle.provider.ts`
- `src/modules/tickets/domain/ticket-actor.ts`
- `src/modules/tickets/services/tickets.service.ts`
- `src/modules/tickets/services/ticket-history.service.ts`
- `src/modules/tickets/services/ticket-details.service.ts`
- `src/modules/tickets/services/tickets-search.service.ts`
- `src/modules/comments/comments.service.ts`
- `src/modules/attachments/attachments.service.ts`
- `src/common/services/ticket-access.service.ts`
- `src/modules/tickets/services/assignment-engine.service.ts`
- `src/modules/sla/sla-auto-close.service.ts`

## Todo et tests

- [ ] Unités : union d’acteur et combinaisons invalides.
- [ ] Intégration : base vide, base peuplée, backfill et compatibilité des binaires N/N-1 sur le schéma expand.
- [ ] SQL : chaque ancien `NOT NULL` est levé et chaque combinaison d’acteur invalide est refusée sur les nouvelles écritures.
- [ ] Intégration : ticket + historique atomiques, puis ticket + historique + outbox lorsqu’un événement est fourni.
- [ ] Régression ciblée : création, recherche, permissions, commentaires, SLA et affectation internes.
- [ ] Jalons complets backend : unitaires, intégration, E2E, OpenAPI et build.

## Critères de succès

- Les données existantes sont toutes lisibles comme acteurs internes.
- Un demandeur externe et une action système peuvent être persistés sans FK utilisateur fictive.
- Une erreur d’historique ou d’outbox fournie annule la création du ticket.
- Le frontend interne continue de recevoir son contrat compatible.
- Aucune colonne héritée n’est supprimée.
- Aucun rollback SQL destructif n’est attendu ; le retour applicatif repose sur flags et compatibilité du schéma additif.
