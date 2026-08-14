# Phase 02 — Observabilité Keycloak (logs, traces, erreurs) + protection brute force

## Statut
- Prévu — dépend de : phase 01 (auth Keycloak-only), D6 acté.
- Références : `keycloak/import/telecom-realm.json` (vérifié le 14/08 : pas de `eventsEnabled`, `eventsListeners`, `bruteForceProtected`), stack Loki/Grafana/Tempo existante, module `audit_logs`.

## Contexte
L'utilisateur a réduit le périmètre Keycloak : **aucun enrichissement** (pas de groups/mappers, step-up, passkeys, organizations…). Le seul besoin restant est de **voir les logs, tracer les erreurs** : activer les événements Keycloak (login, échecs, révocations, admin) et les synchroniser vers `audit_logs`, s'assurer que les logs/traces du conteneur Keycloak remontent dans Loki/Grafana, et activer la protection brute force (D6, 5 échecs/15 min).

## Vue d'ensemble
1. Realm : activer `eventsEnabled`, `eventsListeners` (`jboss-logging`), `adminEventsEnabled`, expiration 30 jours, et `bruteForceProtected` (5 échecs / 15 min).
2. Synchronisation des événements Keycloak vers `audit_logs` avec déduplication (`source_event_id`).
3. Logs/traces Keycloak visibles dans Loki/Grafana (vérifier promtail/collecte Docker, documenter l'accès).
4. Tests d'idempotence, de dédup et de verrouillage brute force.

## Exigences
- **Aucun changement OpenAPI** (Gate A) ; aucun nouveau flow OIDC ; le flux PKCE existant reste identique.
- Aucun doublon dans `audit_logs` : 2 exécutions du sync → aucune ligne dupliquée (Gate C).
- Pas de PII supplémentaire dans les logs au-delà de ce que `audit_logs` stocke déjà (userId, ipAddress, userAgent).
- Le realm reste importable depuis zéro avec cette configuration.

## Architecture
- **Realm** : enrichir `keycloak/import/telecom-realm.json` avec `eventsEnabled: true`, `eventsListeners: ["jboss-logging"]`, `adminEventsEnabled: true`, `eventsExpiration: 2592000` (30 j), `bruteForceProtected: true`, `maxFailedLogins: 5`, `waitIncrementSeconds: 60`, `maxWait: 900`, `failureResetTimeSeconds: 900`. Application **idempotente** : deux importations successives produisent le même état (testé par export).
- **Sync événements** : `keycloak-events.service.ts` (cron configurable `KEYCLOAK_EVENTS_SYNC_CRON`, défaut `*/5 * * * *`) qui interroge `/admin/realms/{realm}/events` (et `/admin/realms/{realm}/admin-events` si besoin), mappe `userId` → `users.id` via `keycloak_subject_id`, insère via `AuditLogsService.createByActor` (SYSTEM, entityType `user`, entityId = `users.id`) avec `onConflictDoNothing` sur `source_event_id` ; événements non mappables ignorés ; page 100, rétention 30 j alignée sur le realm.
- **Migration additive** `0021_audit-source-event-id.sql` : colonne `source_event_id varchar` nullable + index unique partiel (jamais de rollback destructif).
- **Observabilité** : vérifier la collecte des logs du conteneur `keycloak` (promtail/scrape Docker ou `json-file` + Loki) ; ajouter les labels nécessaires (`service=keycloak`, `realm=telecom`) ; documenter la requête Grafana/Loki pour « voir les logs et tracer les erreurs » (ex. `{service="keycloak"} | json | level="ERROR"`). Si la collecte existe déjà, uniquement documenter + test.
- **Brute force** : activé au niveau realm (D6) ; alignement documenté avec le Throttler applicatif (`src/config/app.config.ts`, défaut 20 login/heure) ; un compte test jetable sert au test de verrouillage.

## Étapes
1. Enrichir `keycloak/import/telecom-realm.json` (events, admin events, brute force) ; vérifier idempotence (2× `docker compose up -d keycloak --import-realm` sans écart sur l'export).
2. Migration `0021_audit-source-event-id.sql` + `pnpm run db:generate` ; tests migration base vide/base peuplée.
3. Créer `keycloak-events.service.ts` + spec (dédup, mapping, skip, plafond) ; enregistrer dans `auth.module.ts` ; ajouter `KEYCLOAK_EVENTS_SYNC_CRON` à `.env.example`.
4. Vérifier/configurer la collecte des logs Keycloak (promtail/docker) ; ajouter labels si nécessaire ; écrire la requête Loki/Grafana de référence dans `docs/observability.md` (ou section dédiée de `docs/deployment.md`).
5. Tests runtime : login réussi/échoué → événements présents dans `audit_logs` ; 2 exécutions du cron → aucun doublon ; 5 échecs → compte temporairement verrouillé (compte jetable) ; erreur Keycloak visible dans Grafana (screenshot).

## Fichiers
- **Modifier** : `keycloak/import/telecom-realm.json`, `src/modules/auth/auth.module.ts`, `.env.example`, `promtail/` (config si collecte manquante), `docs/observability.md` ou `docs/deployment.md`.
- **Créer** : `src/database/migrations/0021_audit-source-event-id.sql`, `src/modules/auth/services/keycloak-events.service.ts` (+ spec).
- **Supprimer** : aucun.

## Todo et tests
- [ ] Realm idempotent : 2 importations sans écart (Gate C)
- [ ] Événements login/échec/révocation dans `audit_logs` sans doublon (`source_event_id` unique)
- [ ] Brute force : 5 échecs → verrouillage temporaire (compte jetable)
- [ ] Logs/erreurs Keycloak visibles dans Loki/Grafana (screenshot + requête documentée)
- [ ] `openapi:check` vert ; build + tests verts ; fichiers < 200 lignes

## Critères de succès
- Gate C atteinte : événements dédupliqués dans `audit_logs`, brute force actif, logs/traces Keycloak consultables.
- Le flux PKCE existant et le contrat OpenAPI n'ont pas changé ; aucun écran OTP/passkey ajouté.
