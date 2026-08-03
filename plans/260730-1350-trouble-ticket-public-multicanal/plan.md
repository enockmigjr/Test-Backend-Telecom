# Plan — Trouble ticket public et multicanal

## Statut

- État : phases backend 00 à 04 implémentées. Contrats public/interne exportés, migrations 0011-0012 appliquées,
  pièces jointes publiques en quarantaine avec scan réel et namespace temps réel public isolé. La validation navigateur
  du polling appartient à la phase 05.
- Design source : `docs/superpowers/specs/2026-07-30-trouble-ticket-public-multicanal-design.md`
- Mode : difficile, deux audits en lecture seule puis revue adversariale
- Dépôts : backend, frontend interne, futur `public-frontend`, WordPress PhotoVault

## Objectif

Livrer un support public sans compte obligatoire, utilisable en portail et widget PhotoVault, avec identité vérifiée, suivi, conversations, notifications fiables et bot optionnel, sans régression du ticketing interne.

## Décisions d’exécution

1. Le ticket et `ticket_comments` restent les sources métier après création.
2. Le navigateur public passe par un BFF propre ; NestJS n’est pas exposé directement.
3. `public-frontend/` devient un dépôt Git autonome ignoré par le backend.
4. Email vérifié suffit en Release 1 ; téléphone est facultatif et activé seulement avec un fournisseur réel.
5. Les pièces jointes publiques restent désactivées sans antivirus opérationnel.
6. Les tests sont ciblés par phase ; les suites complètes passent aux jalons 1, 3, 7 et 9.
7. WhatsApp est préparé par contrat d’adaptateur, puis livré séparément après accès Meta et validation métier.

## Séquence

1. [Contrats, topologie et invariants](./phase-00-contracts-topology.md)
2. [Données, acteurs et transaction métier](./phase-01-data-actors-transaction.md)
3. [Compatibilité obligatoire de la console interne](./phase-01b-internal-console-compatibility.md)
4. [Intégrations, identité publique et sécurité](./phase-02-integrations-identity-security.md)
5. [Admission, conversations, outbox et email](./phase-03-admission-conversations-outbox.md)
6. [Pièces jointes et temps réel public](./phase-04-attachments-realtime.md)
7. [Portail public et widget](./phase-05-public-frontend-widget.md)
8. [Connecteur WordPress PhotoVault](./phase-06-wordpress-connector.md)
9. [Administration interne enrichie](./phase-07-internal-frontend-admin.md)
10. [Bot et connaissance publique](./phase-08-bot-knowledge.md)
11. [Durcissement, migration finale et extension des canaux](./phase-09-hardening-rollout-contract.md)

## Chemin critique

`Phase 0 → 1 → 1b → 2 → 3 → 5 → 6 → 7 → 8 → 9`

La phase 4 commence après la phase 3 et peut avancer en parallèle de la préparation visuelle de la phase 5. Le widget PhotoVault ne s’active qu’après validation du portail pleine page.

## Gates absolues

- Aucun frontend public avant export d’un contrat OpenAPI public testé.
- Aucune création publique, même pilote, avant déploiement de la compatibilité console de phase 01b.
- Aucune colonne historique supprimée avant double lecture/écriture et validation du frontend interne.
- Aucun fichier public servi avant statut antivirus `CLEAN`.
- Aucun bot ne peut créer un ticket sans confirmation ou transfert humain explicite.
- Aucune notification externe ne dépend uniquement d’EventEmitter ou de Redis.
- Aucun secret, jeton, OTP ou donnée personnelle complète dans Git ou les journaux.

## Décisions requises avant production

- domaines et origines PhotoVault réels ;
- durées légales de conservation et procédure d’anonymisation ;
- clé maître de chiffrement et infrastructure ClamAV ;
- fournisseur email/SMS et, plus tard, fournisseur IA ;
- navigateurs officiellement supportés et politique de fallback.

## Preuves de clôture

- migrations testées sur base vide et base peuplée ;
- contrats internes et publics figés ;
- parcours public, iframe et PhotoVault validés sur navigateurs cibles ;
- absence d’IDOR et de fuite de notes internes ;
- reprise outbox démontrée après panne ;
- suites complètes des quatre dépôts et manifest de release par SHA.
