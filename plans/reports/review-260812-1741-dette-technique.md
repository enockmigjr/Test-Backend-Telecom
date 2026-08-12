# Revue — Dette technique et déduplications (12/08/2026)

## Périmètre

Revue des changements préparés pour validation par l'utilisateur, portant sur la dette technique identifiée dans l'analyse précédente :

1. Helpers dupliqués
2. Typage incomplet des files BullMQ
3. Double traçabilité `ticket_history` / `audit_logs`
4. Double émission WebSocket
5. Requêtes de rapports dupliquées (worker vs service)
6. Templates email en double (`.hbs` vs inline)
7. Services d'upload public quasi identiques
8. Passage « no-op » du cron d'auto-assignation non mesuré
9. Documentation/contrats obsolètes (traité les 11-12/08)
10. Incohérences ponctuelles (dashboard, faux UUID rapport, workers)

Aucune modification de la logique métier des tickets, du SLA, de l'identité ou des canaux n'a été introduite — uniquement des consolidations, déduplications et corrections documentées ci-dessous.

## Constats [VÉRIFIÉ]

### 1. Helpers centralisés (`src/common/utils/helpers.ts`)

- Nouveau fichier `helpers.ts` + spec : `errorCategory`, `isRecord`, `policyNumber`, `positiveNumber`, `stringArray`, `splitEncrypted`.
- ~20 fichiers modifiés pour importer les helpers au lieu de les redéfinir (workers, intercepteurs, openapi, domaine tickets, services publics, intégrations).
- Les specs existantes ne sont pas modifiées (helpers locaux de test conservés).

### 2. Files BullMQ typées

- `BullMqQueues` déclare désormais les 8 files (l'index signature `[key: string]` est retiré).
- Les 5 getters avec fallback `?? this.queues['x']` sont remplacés par des accès directs typés (`this.queues.email`, `.notification`, `.sla`, `.audit`, `.assignment`).

### 3. Traçabilité complétée

- `TicketAuditListener` écrit désormais `TICKET_DEASSIGNED` (acteur SYSTEM) dans `audit_logs` sur `ticket.deassigned` — la désassignation d'urgence était seulement dans `ticket_history`.
- `docs/domain-events.md` documente « qui écrit quoi » (registre, écrivain, usage, lecture).

### 4. Déduplication WebSocket

- `NotificationWorker` : si le job porte `emitWs: false`, il persiste la notification sans ré-émettre `notification.created`.
- `TicketNotificationListener` et `SlaAlertNotifierService` (warning/breach) passent `emitWs: false` car ils émettent déjà l'événement de domaine en direct.
- `ReportWorker` ne passe pas le flag : le worker reste l'émetteur pour les notifications de rapport.
- Effet attendu : un client ne reçoit plus le même événement deux fois (ex. `ticket.assigned` direct + `notification.created`).

### 5. Rapports : source unique

- `ReportWorker` ne recalcule plus les agrégats : il appelle `ReportQueryService.ticketReport`, `slaReport` et la nouvelle `weeklyReport`.
- Le faux UUID `00000000-…` est remplacé par `REPORT_ID_REQUIRED` (les contrôleurs et le scheduler créent toujours la ligne `reports`).
- ⚠️ Changement de comportement à valider : les périodes par défaut du rapport SLA passent de « 30 jours glissants » à « mois courant » (alignement avec l'endpoint `GET /reports/sla`).

### 6. Emails : source unique

- L'objet `templates = { … }` (~150 lignes, 9 générateurs inline) est supprimé ; les 15 `.hbs` restent la source unique.
- `EmailWorker` utilise `fallbackTemplate(template)` : message générique, sans injection de données utilisateur, sans contenu dupliqué.

### 7. Uploads publics unifiés

- Nouveau `PublicAttachmentUploadService` : contrôle d'accès (ticket ou conversation pré-ticket), politique d'intégration, quota horaire, quarantaine, transaction (message de transport + attachment + outbox).
- `PublicAttachmentsService` et `PublicConversationAttachmentsService` ne gardent que leurs lectures/listes.
- Correction mineure de robustesse : la vérification de l'intégration se fait avant l'accès à `features` (évite un TypeError si l'intégration n'existe pas).

### 8. Métrique du cron d'auto-assignation

- Nouveau compteur Prometheus `telecom_assignment_cron_noop_total`, incrémenté quand le cron ne trouve aucun ticket à router.
- `docs/jobs-and-workers.md` documente le rattrapage idempotent et la métrique.

### 9-10. Incohérences corrigées

- Dashboard `overview` : `compliant` calculé par `COUNT(*) FILTER (WHERE sla_breached = false)` sur le même périmètre (tickets ouverts) que `breached` — ⚠️ changement de périmètre à valider (avant : `total − breached` mélangeait les tickets clôturés).
- `docs/routes.md`, `implementation-status.md`, `domain-events.md`, `jobs-and-workers.md`, `workers.md`, `database-schema.md`, `websockets.md`, `emails.md`, `testing.md`, `security.md`, `environment-variables.md`, `README.md`, `CHANGELOG.md` et le rapport overview du plan multicanal mis à jour.
- Le garde CI OpenAPI (`pnpm run openapi:check` + `git diff --exit-code`) existait déjà et n'a pas eu besoin d'être ajouté.

## Preuves de vérification

- [VÉRIFIÉ] `pnpm run build` : zéro erreur TypeScript.
- [VÉRIFIÉ] `pnpm run test:unit` : **92 suites / 628 tests verts** (12/08/2026), y compris les nouveaux specs `helpers`, `email.service`, `public-attachment-upload.service`.
- [VÉRIFIÉ] Specs ciblés verts : queues, dashboard, SLA (processor + notifier), reports (service + controller), attachments.
- [NON EXÉCUTÉ] E2E WebSocket de la déduplication (nécessite runtime) — à vérifier au prochain lancement E2E.
- [NON EXÉCUTÉ] Test d'égalité « PDF SLA == endpoint `/reports/sla` » (nécessite runtime).
- [NON EXÉCUTÉ] Suite E2E complète (PostgreSQL/Redis) — non lancée pendant cette passe.

## Points de revue recommandés (pour la revue de l'utilisateur)

1. **Helpers** : vérifier qu'aucune copie locale ne subsiste (hors `.spec.ts`) et que les messages d'erreur centralisés (`CIPHERTEXT_INVALID`) ne cassent aucun test d'assertion.
2. **Queues** : confirmer que tous les consommateurs utilisent les clés typées (`email`, `notification`, `sla`, `audit`, `assignment`, `report`, `externalDelivery`, `attachmentScan`).
3. **WebSocket** : valider sur le frontend interne que les événements `ticket.*` directs restent reçus et que `notification.created` n'arrive plus en double.
4. **Rapports SLA** : valider le nouveau défaut de période (mois courant) — décision produit.
5. **Dashboard overview** : valider le nouveau calcul de `compliant` sur les tickets ouverts — décision produit.
6. **Emails** : valider le rendu des 15 `.hbs` (le fallback générique ne doit jamais être visible en conditions normales).
7. **Uploads publics** : valider le parcours complet sur navigateur (quarantaine → ClamAV → `CLEAN` → téléchargement) et l'idempotence.
8. **AGENTS.md** : mis à jour sur disque mais **gitignoré** (`.gitignore:23`) — non commité par conception.

## Verdict

[PRÊT À REVOIR] — aucun P0 ; les changements de comportement volontaires (période SLA, périmètre `compliant`, déduplication WebSocket) sont identifiés et doivent être validés lors de la revue. Les E2E complets restent à exécuter après validation.
