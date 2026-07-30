# Modèle de données du support public

## État

Phase 01 — schéma additif `expand → backfill`, fonctionnalité publique encore désactivée.

## Acteurs

Une mutation de ticket est portée par une union stricte :

- `INTERNAL` : `user_id` renseigné, `external_requester_id` absent ;
- `EXTERNAL_REQUESTER` : demandeur et intégration renseignés, `user_id` absent ;
- `SYSTEM` : aucune FK utilisateur ou demandeur.

Les contraintes SQL refusent les variantes hybrides sur toute nouvelle écriture. Les notes internes restent exclusivement internes et ne reçoivent donc pas de variante externe.

## Cloisonnement

Un demandeur appartient à une seule intégration. Les liens vers demandeurs, tickets, conversations, messages et commentaires utilisent des FK composites comprenant `support_integration_id`. Une simple paire de FK indépendantes n’est pas considérée suffisante.

Le contact canonique est chiffré dans `external_identities`. `external_requesters` ne duplique ni email ni téléphone en clair. Les challenges conservent une destination temporaire chiffrée et seulement les empreintes du contact et du code.

## Compatibilité de déploiement

La migration `0004_trouble-ticket-public-expand.sql` :

- conserve toutes les colonnes historiques ;
- rend nullables les FK utilisateur qui doivent accepter `SYSTEM` ou un demandeur ;
- fournit `actor_type = INTERNAL` par défaut aux binaires N−1 ;
- accepte temporairement `tickets.created_by` comme ouvreur legacy ;
- ajoute les contraintes legacy en `NOT VALID`, actives sur les nouvelles écritures sans scan bloquant.

La migration `0005_trouble-ticket-actor-backfill.sql` copie `created_by` vers `opened_by_user_id` et normalise les acteurs legacy. La validation et le resserrement définitifs sont réservés à la phase 09, après retrait du binaire N−1.

## Transaction métier

`TicketsService.create()` adapte la route interne vers `createFromCommand()`. Cette commande écrit dans une même transaction :

1. le ticket ;
2. son historique ;
3. zéro ou plusieurs événements outbox explicitement fournis.

EventEmitter, métriques et journal applicatif ne s’exécutent qu’après commit. Le chemin interne fournit zéro événement outbox tant que le support public est désactivé, évitant les notifications doubles.

## Pièces jointes et messages

Une pièce jointe possède exactement un parent parmi ticket, commentaire, note interne ou message de support. Les fichiers publics utiliseront un état de scan ; leur activation reste interdite avant la phase antivirus. Un message de support porte le contenu avant création du ticket puis référence le commentaire canonique sans recopier ce contenu.
