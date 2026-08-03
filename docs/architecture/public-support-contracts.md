# Contrats structurants du support public

Statut : backend des phases 00 à 04 implémenté ; portail public encore à réaliser

## Sources

- Design validé : `docs/superpowers/specs/2026-07-30-trouble-ticket-public-multicanal-design.md`
- Plan validé : `plans/260730-1350-trouble-ticket-public-multicanal/plan.md`
- Contrat interne : `openapi.json`
- Projection publique : `openapi.public.json`

## Frontières de dépôts

| Dépôt | Responsabilité | Données d’authentification |
|---|---|---|
| Backend | règles, données, OpenAPI, événements | valide les principaux internes et publics |
| `frontend/` | console agents et administration | cookies et audience internes uniquement |
| `public-frontend/` | portail, BFF public et iframe | cookies et audience publics uniquement |
| WordPress PhotoVault | connecteur et assertion | secret d’intégration côté serveur seulement |

Le backend ignore les deux dépôts frontend. Le plugin WordPress sera suivi par le dépôt WordPress avec des règles de négation ciblées ; WordPress Core et les trois plugins actuels ne sont pas modifiés.

## Contrats OpenAPI

`openapi.json` reste le contrat complet de la console interne. `openapi.public.json` est une projection opt-in : une opération n’y entre que si elle porte `x-api-audience: public-support`.

La projection :

- supprime les opérations non marquées ;
- conserve seulement les composants transitivement référencés ;
- n’hérite pas de la sécurité Bearer interne ;
- exclut notes internes, audit, secrets et routes administratives ;
- est sérialisée de manière déterministe et hashable.

État après phase 04 : 118 opérations internes et 26 opérations de support public exportées depuis le code.

## Acteur métier cible

```text
INTERNAL            -> userId présent, requesterId absent
EXTERNAL_REQUESTER  -> requesterId présent, userId absent
SYSTEM              -> userId et requesterId absents
```

Un ticket peut avoir un agent ouvreur, un demandeur externe, ou les deux lorsque l’agent agit pour le client. Aucun utilisateur technique ne représente le public ou le système.

## Statuts publics

| Statut interne | Statut public | Règle d’affichage |
|---|---|---|
| `NEW`, `ASSIGNED` | `RECEIVED` | demande reçue, organisation masquée |
| `IN_PROGRESS`, `REOPENED` | `IN_PROGRESS` | traitement en cours |
| `PENDING_THIRD_PARTY` | `IN_PROGRESS` | tiers interne non exposé |
| `PENDING_CUSTOMER` | `WAITING_FOR_CUSTOMER` | action du demandeur attendue |
| `RESOLVED` | `RESOLVED` | solution publique disponible |
| `CLOSED`, `CANCELLED` | `CLOSED` | motif public assaini si nécessaire |

Le SLA commence à la création confirmée du ticket. Le temps conversationnel précédent est une métrique d’admission distincte.

## Enveloppe d’événement public

Chaque événement comporte : `eventId`, `eventName`, `schemaVersion`, `occurredAt`, `mutationId`, `integrationId`, `ticketId`, `requesterId` et acteur typé. Le payload référence les entités immuables ; il n’embarque pas de note interne.

| Événement v1 | Déclencheur |
|---|---|
| `PUBLIC_TICKET_CREATED` | création confirmée ou handoff |
| `PUBLIC_REPLY_CREATED` | réponse agent immuable |
| `PUBLIC_REPLY_CORRECTED` | nouveau message corrigeant une réponse |
| `PUBLIC_INFORMATION_REQUESTED` | action du demandeur requise |
| `PUBLIC_STATUS_CHANGED` | changement public pertinent |
| `PUBLIC_TICKET_RESOLVED` | résolution |
| `PUBLIC_TICKET_CLOSED` | clôture ou annulation publique |
| `PUBLIC_TICKET_REOPENED` | réouverture |
| `PUBLIC_HUMAN_HANDOFF_REQUESTED` | demande ou politique de transfert |

`outboxEventId` devient le `jobId` BullMQ. Une livraison est unique localement par `(outboxEventId, channel, destinationKey)`. Le transport reste at-least-once ; un résultat fournisseur ambigu devient `DELIVERY_UNKNOWN` et exige une réconciliation.

## Topologie réseau cible

```text
Navigateur interne -> frontend BFF -> Nginx -> NestJS privé -> /ws
Navigateur public  -> public BFF   -> Nginx -> NestJS privé -> /public-support
Site intégrateur   -> widget.js    -> iframe du domaine support
WordPress serveur  -> assertion signée courte, jamais de session interne
```

Les origines de sites intégrateurs servent à `frame-ancestors` et `postMessage`, pas au CORS dynamique du backend. Le navigateur public ne contacte jamais NestJS directement.

## Espaces d’authentification réservés

| Usage | Valeur réservée |
|---|---|
| Audience session publique | `telecom-public-support` |
| Audience assertion intégration | `telecom-public-support-assertion` |
| Audience bootstrap top-level | `telecom-public-support-bootstrap` |
| Cookie iframe | `__Host-support_iframe` |
| Cookie pleine page | `__Host-support_session` |
| Namespace temps réel | `/public-support` |

Le cookie iframe sera `Secure; HttpOnly; SameSite=None; Partitioned`. Le cookie pleine page sera `Secure; HttpOnly; SameSite=Lax`. Le CSRF public utilise un synchronizer token retourné par une route `no-store` et conservé en mémoire.

Le passage iframe → pleine page utilise un code opaque à usage unique placé dans le fragment, échangé par POST puis supprimé par `history.replaceState`. Aucun token ne circule en query string ou dans les journaux.

## Temps réel public et repli polling

Le namespace Socket.IO `/public-support` utilise uniquement la session publique en cookie et des rooms calculées côté serveur. Ses événements ne contiennent que `{ resource, id }` et demandent au client de relire l’état persistant par REST.

Le portail de phase 05 doit considérer le WebSocket comme une optimisation :

- après connexion ou reconnexion, relire le ticket, la chronologie et les pièces jointes ;
- si le WebSocket échoue, interroger les routes GET publiques avec un délai progressif et suspendre le polling lorsque l’onglet est masqué ;
- conserver les mutations HTTP indépendantes du canal temps réel ;
- utiliser le passage iframe vers la pleine page lorsque les cookies tiers sont indisponibles.

Les routes de liste et d’état des pièces jointes restent autoritatives. Aucun téléchargement n’est exposé avant le statut antivirus `CLEAN`.

## Matrice de responsabilité

| Acteur | Capacités publiques |
|---|---|
| Administrateur | intégrations, secrets, politiques, routage, quotas, livraisons et fusion auditée |
| Superviseur autorisé | consultation des demandeurs/livraisons et relance selon permission |
| Agent interne | consulter et répondre aux tickets déjà visibles selon RBAC/ABAC |
| Demandeur externe | créer et consulter uniquement ses tickets dans son intégration |
| Système | routage, SLA, outbox et tâches automatiques sans faux utilisateur |

## Décisions requises avant production

| Décision | Responsable attendu | Gate |
|---|---|---|
| domaine support et origines PhotoVault | exploitation + produit | avant phase 05 déployée |
| rétention et anonymisation | métier + juridique | avant phase 09 |
| clé maître AES-GCM | sécurité + exploitation | avant phase 02 production |
| service ClamAV et limites | exploitation | avant activation des fichiers |
| fournisseur email et politique anti-abus | exploitation + sécurité | avant phase 03 production |
| fournisseur SMS facultatif | produit | après Release 1 email |
| fournisseur IA et région de traitement | produit + juridique | avant phase 08 |
| navigateurs supportés | produit + QA | avant pilote PhotoVault |

## Gate de phase 00

La phase est fermée lorsque les deux artefacts sont déterministes, la projection ne fuit aucun composant interne, les frontières Git sont écrites et le manifest de baseline contient les SHA et hashes vérifiés.
