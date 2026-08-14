# Phase 04 — Files BullMQ, outbox et livraisons

## Statut
- Prévu — dépend de Phase 00
- Findings traités : **P1-9** (queue email sans retry), **P1-11** (DELIVERY_UNKNOWN terminal), **P2-25** (rétention jobs audit/notification), **P2-26** (outbox FAILED jamais rejoué + tables jamais purgées), **P2-27** (ReportWorker neutralise les retries), **P2-28** (queues sans attempts), **P2-29** (OTP SMTP synchrone), **P2-30** (listener satisfaction sans try/catch), **P3-z** (requeue sans jobId), **P3-aa** (completedAt sur failed), **P3-ac** (getUserEmail avale les erreurs), **P3-ah** (cron hebdo multi-instance)

## Contexte
La politique de retry est incohérente entre les 8 files : seule report/externalDelivery/attachmentScan ont `defaultJobOptions` ; email/notification/sla/audit/assignment échouent en une tentative. `DELIVERY_UNKNOWN` et `FAILED` outbox sont des états terminaux sans rejeu ni alerte. ReportWorker avale toutes les erreurs (les attempts=3 configurés ne servent jamais). Les tables `outbox_events`/`external_deliveries` grossissent sans purge.

## Vue d'ensemble
1. **P1-9/P2-28** : ajouter `defaultJobOptions: { attempts, backoff }` sur email (3, exponential 5 s), notification, sla, audit, assignment (3-5, exponential) ; corriger le log du worker email (« retry=3 » faux).
2. **P1-11** : inclure `DELIVERY_UNKNOWN` dans `requeueFailedDeliveries` (délai long via `updatedAt`), ajouter `POST /admin/external-deliveries/:id/retry`, dédupliquer via `providerMessageId` ; émettre une alerte à l'entrée dans cet état.
3. **P2-26** : cron de rejeu des outbox `FAILED` (backoff borné) ou endpoint admin ; cron de purge (`PUBLISHED`/`DELIVERED` > 30/90 jours, mêmes critères que `removeOnComplete` Redis).
4. **P2-27** : ReportWorker — catcher uniquement pour journaliser puis relancer l'erreur (laisser BullMQ retrier) ; marquer `failed` seulement sur la dernière tentative (pattern `finalAttempt` de attachment-scan.worker).
5. **P2-25** : basculer audit/notification sur `removeOnComplete: { age: 3600 }` (ou ne stocker que des IDs dans les payloads).
6. **P2-29** : passer l'envoi OTP par `queues.email.add` (avec attempts) ; traiter le rejet de `afterCommit`.
7. **P2-30** : encapsuler l'insert outbox du listener satisfaction dans try/catch avec retry/compensation ; rattraper uniquement `ConflictException` sinon logger + relancer.
8. **P3-z** : `jobId: delivery.outboxEventId` dans `requeueFailedDeliveries`.
9. **P3-aa** : `completedAt` uniquement si `status === 'completed'` (+ `failedAt` sinon).
10. **P3-ac** : logger les erreurs de `getUserEmail` avant `return null`.
11. **P3-ah** : verrou distribué ou `jobId` fixe `weekly-report-YYYY-Wxx` pour le cron hebdo.

## Exigences
- Les payloads de jobs existants restent compatibles (aucune rupture de consommation).
- L'ordre de priorité : email > external-delivery > audit (piste immuable).

## Étapes
1. Tests rouges : job email qui échoue → retry jusqu'à 3 ; DELIVERY_UNKNOWN rejoué ; outbox FAILED rejoué.
2. Config des queues (queues.module.ts) + logs corrigés.
3. Refactorer external-delivery (rejeu UNKNOWN + endpoint admin + alerte).
4. Cron de purge (settings ou module dédié) avec bornes documentées.
5. ReportWorker : pattern finalAttempt.
6. OTP via queue + listener satisfaction résilient.
7. Tests unitaires des workers (retries, statuts) + intégration.

## Fichiers
- **Modifier** : `src/queues/queues.module.ts`, `src/queues/workers/email.worker.ts`, `report.worker.ts`, `audit.worker.ts`, `notification.worker.ts`, `src/modules/external-delivery/` (service + admin controller), `src/modules/outbox/services/outbox.service.ts`, `src/modules/external-identity/providers/email-contact-verification.provider.ts`, `contact-verification.service.ts`, `src/modules/support-satisfaction/ticket-satisfaction.listener.ts`, `src/modules/reports/reports.service.ts`, `report-scheduler.service.ts`, specs
- **Créer** : `src/modules/external-delivery/dto/retry-delivery.dto.ts` (si nécessaire), cron de purge `src/modules/outbox/outbox-cleanup.cron.ts` (+ spec)

## Todo
- [ ] attempts/backoff sur les 5 queues manquantes (P1-9/P2-28)
- [ ] Log email worker corrigé
- [ ] DELIVERY_UNKNOWN rejoué + endpoint retry + alerte (P1-11)
- [ ] Outbox FAILED rejoué + purge cron (P2-26)
- [ ] ReportWorker : finalAttempt (P2-27)
- [ ] Rétention jobs audit/notification bornée (P2-25)
- [ ] OTP via queue (P2-29)
- [ ] Listener satisfaction résilient (P2-30)
- [ ] jobId requeue + completedAt + getUserEmail loggée (P3)
- [ ] Verrou cron hebdo (P3-ah)

## Critères de succès
- Gate D : les 8 queues ont attempts/backoff ; aucun état terminal sans rejeu ou alerte (DELIVERY_UNKNOWN, FAILED outbox).
- Aucun email dupliqué (dédup par jobId et providerMessageId vérifiée par tests).
