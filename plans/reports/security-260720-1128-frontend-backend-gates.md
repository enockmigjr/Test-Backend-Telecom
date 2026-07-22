# Registre des gates backend avant frontend production

## État de fermeture après validation

Les constats ci-dessous sont conservés comme trace de l'audit initial. Les gates P0 et P1 ont été fermées avant la création du frontend :

- isolation tickets, audit, commentaires, notes et pièces jointes, couverte en E2E inter-départements ;
- rotation refresh atomique, compte actif, contexte IP/User-Agent et WebSocket par cookie avec rooms serveur ;
- `logout` déconnecte la session WebSocket ciblée ; `logout-all` invalide les access tokens antérieurs et ferme tous les sockets de l'utilisateur ;
- événements WebSocket limités aux rooms utilisateur et département, sans room globale de rôle ;
- CORS WebSocket en allowlist et secrets de production obligatoires ;
- réponses et pagination normalisées, détails de validation préservés ;
- idempotence PostgreSQL transactionnelle réellement câblée, avec rejeu concurrent et effets différés après commit ;
- catégorie dynamique, projections créateur/assigné, recherche, tri et détail complet corrigés ;
- listing/statut des rapports avec scope superviseur, dashboard départements limité au département ;
- SLA première réponse et résolution suivis séparément avec migration et alertes atomiques ;
- échéance de résolution calculée dès la création depuis la politique SLA, sans valeur arbitraire ;
- assignation et escalade refusées si l'utilisateur cible est inactif ou n'appartient pas à l'équipe cible ;
- KPI dashboard calculés en base (jour courant, médiane, P90 et tendances réelles) ;
- OpenAPI exporté de façon déterministe, versionné et contrôlé en CI.

Les capacités produit absentes qui nécessitent de nouveaux modèles backend restent volontairement dans `analysis-260720-1128-frontend-capabilities.md` et ne sont pas simulées côté frontend.

## Priorité P0 — sécurité et session

| ID    | Constat vérifié                                                                        | Risque                                                              | Preuve de fermeture                                                                |
| ----- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| P0-01 | `GET /tickets` ne reçoit pas l'utilisateur et la recherche n'ajoute aucun scope.       | Exposition inter-départements.                                      | Tests E2E liste/recherche avec deux départements et refus des données hors scope.  |
| P0-02 | Le détail audit ne reçoit pas l'utilisateur, contrairement à la liste filtrée.         | Lecture d'un audit hors périmètre par UUID.                         | Scope identique liste/détail et tests supervisor inter-départements.               |
| P0-03 | Commentaires et notes list/create ne vérifient pas explicitement la visibilité ticket. | Lecture/écriture croisée par UUID.                                  | Autorisation commune réutilisée et tests négatifs list/create/update/delete.       |
| P0-04 | Upload/download/delete de fichiers ne prouvent pas l'accès à la ressource parente.     | IDOR et exfiltration de fichiers.                                   | Autorisation parent, association unique, tests croisés et téléchargement refusé.   |
| P0-05 | `join_room` accepte une room fournie par le client.                                    | Abonnement à `user:*`, `role:*` ou `department:*` arbitraire.       | Rooms calculées côté serveur, aucune room de rôle globale, tests d'isolation.      |
| P0-06 | CORS WebSocket vaut `*` avec credentials et un secret de repli existe.                 | Origines non maîtrisées et mauvaise configuration prod silencieuse. | Origines validées; démarrage prod impossible sans secret explicite.                |
| P0-07 | Refresh renvoie le même refresh token.                                                 | Vol prolongé, replay et contradiction avec la rotation annoncée.    | Rotation atomique, reuse detection, révocation de famille et tests concurrence.    |
| P0-08 | Tokens renvoyés dans JSON, aucune stratégie cookie/CSRF définie.                       | Stockage navigateur dangereux ou architecture jetable.              | ADR BFF/cookies `__Host-`/CSRF/WS adopté; révocation HTTP/WS prouvée côté backend. |

## Priorité P0 — contrat et intégrité

| ID    | Constat vérifié                                                                                  | Risque                                                     | Preuve de fermeture                                                    |
| ----- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| P0-09 | OpenAPI runtime contient 79 opérations mais presque aucun schéma de réponse.                     | Client généré faiblement typé et dérive frontend/backend.  | DTOs/enveloppes documentés, snapshot déterministe et contract test CI. |
| P0-10 | Les réponses succès ont plusieurs formes, dont pagination imbriquée et rapports déjà enveloppés. | Normalisation fragile et erreurs runtime.                  | Une enveloppe canonique par type de réponse et tests sérialisation.    |
| P0-11 | L'idempotence est décorée mais le middleware n'est pas enregistré.                               | Double création ou double action sous retry/clic multiple. | Intercepteur PostgreSQL atomique, rejeu concurrent et rollback testés. |
| P0-12 | Update ticket accepte `category` mais le service attend `categoryId`.                            | Succès apparent sans modification.                         | DTO/service alignés sur catégorie dynamique et E2E de mise à jour.     |
| P0-13 | Projection ticket utilise un alias utilisateur ambigu pour créateur/assigné.                     | Mauvaise identité affichée.                                | Deux alias SQL distincts et test avec créateur différent de l'assigné. |
| P0-14 | `mustChangePassword` n'est pas garanti dans la session frontend.                                 | Contournement du parcours de changement initial.           | Champ contractuel et redirection E2E obligatoire.                      |
| P0-15 | Aucun listing de pièces jointes et upload multipart divergent de Swagger.                        | `FileAttachmentList` impossible et intégration erronée.    | Route/listing ou inclusion typée; contrat multipart testé.             |

## Priorité P1 — fidélité fonctionnelle

| ID    | Écart                                                                           | Décision attendue                                                  |
| ----- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| P1-01 | `sort` annoncé mais seul `createdAt` est réellement trié.                       | Corriger le tri ou réduire explicitement le contrat.               |
| P1-02 | Recherche annoncée sur client mais requête limitée au titre/description/numéro. | Ajouter les champs client ou corriger Swagger.                     |
| P1-03 | `detail=full` promet plus que la réponse réelle.                                | Implémenter ou retirer la promesse.                                |
| P1-04 | Supervisor documenté global mais souvent limité à son département.              | Adopter une matrice définitive et la tester.                       |
| P1-05 | Gestion SLA supervisor dans le design, admin seulement dans le contrôleur.      | Décision produit/RBAC explicite.                                   |
| P1-06 | Dashboard départements documenté supervisor/admin, contrôleur admin.            | Décision produit/RBAC explicite.                                   |
| P1-07 | Générateur de rapport supervisor sans endpoint de statut/listing personnel.     | Notification finale suffisante en MVP ou nouvelle route de statut. |
| P1-08 | SLA première réponse calculé mais non suivi séparément du SLA résolution.       | Modèle et métriques distincts avant promesse UI complète.          |

## Ordre de fermeture exécuté

1. Décider topologie session/BFF/WS.
2. Fermer les fuites d'isolation P0-01 à P0-06.
3. Corriger rotation et concurrence P0-07/P0-08.
4. Stabiliser contrats P0-09/P0-10/P0-12/P0-13/P0-14/P0-15.
5. Activer et prouver l'idempotence P0-11.
6. Arbitrer les écarts P1 avant les pages concernées.

## Gate de démarrage frontend

Le frontend ne démarre qu'après validation finale build, intégration, E2E et OpenAPI, puis commit backend. Les tests CSRF et multi-onglets relèvent du BFF et devront passer avant que le frontend soit déclaré production-ready.

## Validation finale backend

- revue P0/P1 : GO, aucun constat critique ou important résiduel ;
- build NestJS et TypeScript strict : réussis ;
- intégration : 4 suites, 12 tests réussis ;
- E2E : 15 suites, 125 tests réussis, dont concurrence refresh/logout-all, idempotence et refus inter-départements ;
- contrat OpenAPI : 81 opérations et 5 contrôles de snapshot réussis ;
- `openapi.json` doit être inclus dans le commit backend afin que la gate CI soit reproductible sur un checkout propre.
