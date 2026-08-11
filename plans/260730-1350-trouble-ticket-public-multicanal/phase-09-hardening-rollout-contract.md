# Phase 09 — Durcissement, rollout et migration finale

## Statut

- Débuté : script db:phase9-check (7 vérifications SQL de cohérence acteur/intégration/outbox/livraisons) — toutes vertes sur la base locale — et endpoint admin d'anonymisation des demandeurs (effacement des valeurs d'identité chiffrées, révocation appareils/challenges, audit, idempotent).
- Migration 0016 appliquée : les 6 contraintes acteur NOT VALID (tickets presence/legacy/integration, audit_logs, ticket_comments, ticket_history) sont validées — données propres (0 violation).
- Preuve code : openedByUserId est lu à 20 emplacements backend et en fallback frontend (openedByUserId ?? createdBy) ; created_by n'est plus le seul lecteur. Sa suppression reste soumise à la fenêtre de compatibilité.
- Tests de pannes : spec SupportBotService couvrant les replis fournisseur absent/erreur (disabled/unavailable → formulaire) et livraison OK ; vérification live déjà effectuée (mode disabled sur la pile). Les autres voies (Redis/BullMQ down, ClamAV, outbox) restent couvertes par les specs existantes (queues.module, clamav-scanner, outbox).
- Reste : rétention/effacement du contenu des messages (politique), drill complet des pannes PostgreSQL/email/WebSocket, rollout PhotoVault et manifest par SHA.

## Contexte

Toutes les capacités existent derrière des flags. La dernière phase prouve sécurité, résilience et compatibilité avant d’enlever les colonnes de transition.

## Vue d’ensemble

Valider les contraintes, tester les pannes, activer PhotoVault progressivement, fixer l’exploitation et préparer les prochains canaux sans les implémenter prématurément.

## Exigences

- Rollback par flags et compatibilité, jamais par suppression urgente de données.
- Contraintes finales seulement après preuve de disparition des anciens lecteurs.
- Manifest de release avec SHA de chaque dépôt.
- Aucun label métrique à haute cardinalité.
- Rétention, anonymisation, sauvegarde et réponse incident documentées.
- WhatsApp reste hors production sans compte Meta, consentement et modèles approuvés.

## Architecture

Activation : backend sombre, portail/email pilote, widget PhotoVault, bot pilote, puis autres intégrations. Les migrations finales valident d’abord les `CHECK NOT VALID`; la suppression de `created_by` est une opération ultérieure distincte.

## Étapes

1. Exécuter vérifications SQL de cohérence acteur, intégration, identité, outbox et livraisons.
2. Ajouter puis valider les contraintes acteur dans une migration dédiée, sans verrou long non évalué.
3. Prouver par recherche de code, métriques et logs que `created_by` n’est plus le seul lecteur avant migration legacy.
4. Conserver une fenêtre de compatibilité de release complète avant toute suppression de colonne.
5. Tester pannes PostgreSQL partielles, Redis, BullMQ, email, ClamAV, WebSocket, WordPress et fournisseur IA.
6. Vérifier reprise outbox, déduplication locale et visibilité de toute ambiguïté fournisseur ; ne pas prétendre à exactly-once.
7. Tester sécurité : IDOR, CSRF, CORS, CSWSH, rejeu, enumeration, quotas, XSS, uploads et fuite de notes.
8. Valider sauvegarde/restauration des nouvelles tables et révocation de secrets compromise.
9. Finaliser dashboards : admission, vérification, première réponse, SLA, outbox, livraison, scan, bot et abus.
10. Définir SLO, alertes, runbooks, rétention et anonymisation avec responsables métier.
11. Activer une intégration PhotoVault pilote, observer, puis élargir par feature flag.
12. Créer des tests de contrat pour un adaptateur futur ; ne créer `whatsapp-channel.adapter.ts` qu’au démarrage du projet WhatsApp réel.
13. Vérifier `git ls-files` dans chaque dépôt ; refuser le manifest si le plugin WordPress actif ou son miroir ne sont pas suivis.
14. Produire le manifest des SHA backend, frontend interne, public frontend, WordPress et des hashes des deux contrats OpenAPI.

## Gates de validation

Backend : lint sans correction implicite, typecheck, unitaires, intégration, E2E, OpenAPI et build.

Frontend interne et public : contrat, lint, typecheck, unitaires, build et Playwright sur navigateurs supportés.

WordPress : syntaxe, runtime réel, miroirs, Makefile/CI et scénarios navigateur PhotoVault.

Infrastructure : images, migrations de staging, healthchecks, alertes, sauvegarde/restauration et rollback par flag.

## Todo

- [ ] Toutes les décisions de production de phase 00 sont closes.
- [ ] Tests complets verts une fois sur les SHA de release.
- [ ] Pilote PhotoVault sans régression mesurée.
- [ ] Contraintes SQL validées et colonne legacy encore conservée durant observation.
- [ ] Runbooks et manifest signés par les responsables.
- [ ] Le SHA WordPress contient le plugin réellement exécuté, pas seulement les scripts d’infrastructure.

## Critères de succès

- Une panne de canal ne bloque ni ticketing interne ni formulaire public.
- Une réponse externe est dédupliquée localement, livrée au moins une fois lorsqu’elle est confirmée, ou marquée `DELIVERY_UNKNOWN` pour réconciliation manuelle.
- Aucun accès inter-demandeur ou inter-intégration n’est possible.
- Le retrait ultérieur du legacy est prouvé sûr, pas seulement supposé.
- Ajouter un canal nécessite un adaptateur et ses politiques, pas une modification du cœur ticket.
## Rollout progressif

1. Backend public (sombre) : fait, opérationnel sur la pile compose.
2. Portail + email pilote : fait (recette validée).
3. Widget PhotoVault : fait (recette Chromium/Firefox/WebKit validée).
4. Bot pilote : en attente du fournisseur IA.
5. Autres intégrations (WhatsApp, sites tiers) : contrat d'adaptateur prêt, activation après décision.

## Drill de pannes (procédure)

- PostgreSQL arrêté : API en erreur 5xx standardisée, démarrage impossible ; restaurer le conteneur puis vérifier outbox (reprise après lease).
- Redis arrêté : rate-limit dégradé, workers BullMQ en attente ; les tests unitaires simulent déjà Redis indisponible (jwt blacklist, token cleanup).
- BullMQ arrêté : jobs SLA/delivery relancés au redémarrage (retry borné) ; vérifier external_deliveries (PENDING → FAILED après maxAttempts).
- Email/Mailpit arrêté : delivery marquée PENDING puis FAILED après 5 tentatives, sans perte métier (ticket déjà créé). Drill réel exécuté : ticket INC-2026-000028 créé pendant la coupure → ttempt_count=5, ETIMEDOUT, FAILED → correctif livré (rejeu périodique 60 s des FAILED, borne 40 tentatives / fenêtre 7 j, sans jobId BullMQ) → reprise vérifiée DELIVERED et email présent dans Mailpit après restauration. Couverture automatisée ajoutée (spec rejeu : FAILED → PENDING → re-ajout sans jobId).
- ClamAV arrêté : scan en erreur → fichier en QUARANTINE/ERROR, jamais servi (gate antivirus).
- WebSocket coupé : le portail bascule en polling (repli déjà implémenté).
- WordPress hors ligne : le widget affiche le fallback pleine page ; aucun ticket n'est stocké côté WP.
- Fournisseur IA indisponible : le bot répond unavailable → formulaire (couvert par spec).
## Politique de rétention (proposition à valider)

- Tickets et messages : conservés 3 ans après clôture, puis suppression programmée (batch hebdomadaire, par lots, hors heures de pointe).
- Demandeur : anonymisé automatiquement 13 mois après la dernière activité (aucun ticket ouvert) ; appareils de confiance expirés à la révocation.
- Challenges OTP et idempotence : purge après 24 h / 30 j.
- Options par intégration : durée de rétention configurable et désactivation de l'anonymisation automatique (audit de chaque modification).
