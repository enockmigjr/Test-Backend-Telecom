# Audit backend pour le plan multicanal

## Périmètre

Lecture du backend NestJS, des schémas Drizzle, migrations, tickets, commentaires, historique, pièces jointes, notifications, SLA, WebSocket, files et OpenAPI. Aucun fichier applicatif modifié et aucun test lancé.

## Constats

- `tickets.created_by`, `ticket_comments.author_id`, `ticket_history.user_id`, `attachments.uploaded_by`, `audit_logs.user_id` et `ticket_assignments.assigned_by` exigent un utilisateur interne.
- `TicketsService.create()` ne garantit pas encore dans une seule transaction ticket, historique et événement durable.
- `DrizzleProvider.runInTransaction()` et `afterCommit()` sont réutilisables, après prise en charge d’une transaction déjà active.
- Les listeners abandonnent des jobs lorsque Redis est indisponible ; acceptable pour certains effets internes, insuffisant pour une livraison externe garantie.
- `CommentsService` ne produit ni historique ni événement et doit matérialiser la première réponse sur un ticket public.
- `AssignmentEngineService` est réutilisable une fois les champs internes calculés par la politique d’admission.
- `/ws` est exclusivement interne et ne doit pas authentifier un demandeur externe.
- La sécurité fichier contrôle surtout extension et MIME déclaré ; quarantaine, signature réelle et antivirus manquent.
- L’OpenAPI compte actuellement 83 opérations, mais ce nombre doit toujours être recalculé après export.

## Risques dominants

- perte d’événement entre PostgreSQL et BullMQ ;
- double notification pendant la coexistence EventEmitter/outbox ;
- régression lorsque les identifiants d’acteur deviennent conditionnels ;
- fuite de note interne dans une chronologie agrégée ;
- première réponse SLA non matérialisée sur un commentaire agent ;
- cardinalité Prometheus excessive si les identifiants métier deviennent des labels ;
- faux utilisateurs administrateurs encore employés pour certaines actions système.

## Recommandations retenues

- union discriminée `INTERNAL | EXTERNAL_REQUESTER | SYSTEM` et contraintes SQL ;
- migration `expand → backfill → dual read/write → validate → contract` ;
- commande transactionnelle commune pour les créations internes et publiques ;
- outbox PostgreSQL avec réservation `FOR UPDATE SKIP LOCKED` et idempotence ;
- gardes, DTO, audience et namespace publics séparés ;
- filtrage d’accès par ticket, demandeur et intégration ;
- désactivation des fichiers publics tant qu’un scanner réel n’est pas sain.
