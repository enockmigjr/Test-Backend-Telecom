# Phase 03 — Tickets : atomicité, machine à états, SLA

## Statut
- Prévu — dépend de Phase 02 (pas de blocage fonctionnel, mais la décision D1 sur la matrice RBAC doit être actée avant)
- Findings traités : **P1-5** (assign/escalate contournent la machine à états), **P1-6** (écritures non atomiques), **P2-1** (SLA première réponse non pause-aware), **P2-2** (pause perdue sur PENDING→RESOLVED), **P2-3** (update sans recalcul SLA), **P2-4** (rallonge réouverture en dur), **P2-9** (écart matrice RBAC close/reopen — décision D1), **P2-10** (unicité nom département), **P2-11** (catégorie email vide), **P2-12** (code mort SLA)

## Contexte
`changeStatus` est exemplaire (verrou optimiste, transitions validées), mais `assign`, `escalate` et `update` écrivent hors transaction, sans validation d'état ni condition optimiste : un ticket CLOSED peut être réassigné, deux agents peuvent s'auto-assigner en parallèle, et une panne entre l'insert et l'update laisse des données incohérentes. Le SLA souffre d'incohérences (pause non propagée à la première réponse, échéances non recalculées à l'update).

## Vue d'ensemble
1. **P1-5** : étendre `checkCanAssign`/`checkCanEscalate` (interdire CLOSED/CANCELLED, exiger les transitions valides) et forcer `NEW → ASSIGNED` quand un assigné est posé ; rendre l'UPDATE conditionnel sur le statut.
2. **P1-6** : envelopper les 3 écritures (insert assignment → update ticket → history) dans `runInTransaction` avec condition d'état dans l'UPDATE (pattern claim `returning` + retry, comme `SlaAutoCloseService.process()`).
3. **P2-1** : exclure les tickets en pause (`slaPausedAt` non nul) du ciblage FIRST_RESPONSE (comme RESOLUTION) ; étendre `firstResponseDueAt` au resume.
4. **P2-2** : cumuler `accumulatedPauseMs` sur toutes les sorties de PENDING (y compris → RESOLVED) avant nettoyage.
5. **P2-3** : sur changement de `categoryId`/`priority` dans `update()`, re-résoudre la politique SLA et recalculer les échéances (factoriser la logique de `createFromCommand` dans un service dédié).
6. **P2-4** : remplacer la rallonge +240 min en dur par une re-résolution de politique du ticket (ou une valeur configurable via `SettingsService`).
7. **P2-9 (décision D1)** : selon la décision, restreindre `checkCanClose`/`checkCanReopen` à la matrice (close/reopen = SUPERVISOR/ADMIN) OU mettre à jour AGENTS.md ; ajouter un test de conformité RBAC.
8. **P2-10** : vérification d'unicité du nom dans `DepartmentsService.update` (pattern de `categories.service.ts`).
9. **P2-11** : utiliser `event.ticket['categoryName']` (fallback) dans le listener d'email.
10. **P2-12** : brancher `createFromCommand` sur `SlaPoliciesService.findByCategoryAndPriority` (source unique) et supprimer `SlaEngineService.calculateDueDate`/`TicketHistoryService.record` si orphelins.

## Exigences
- Machine à états : ne casser aucune transition actuellement testée (`ticket-status-transitions.spec.ts`).
- Le contrat OpenAPI des routes tickets ne change pas (sauf messages d'erreur éventuels).

## Étapes
1. Tests rouges : assign sur CLOSED refusé ; double auto-assignation → une seule gagne ; pause PENDING→RESOLVED cumulée ; update LOW→CRITICAL recalcule l'échéance.
2. Refactorer `TicketsService` : extraire `resolveSlaPolicyAndDeadlines()` (réutilisé par create/update/reopen) ; transactionner assign/escalate/update.
3. Corriger les branches SLA du `buildSlaUpdateFields` et le processeur de breach.
4. Appliquer la décision D1 (code ou doc + test de conformité).
5. Unicité département, catégorie email, code mort SLA.
6. Tests unitaires complets + E2E tickets (cycle de vie complet).

## Fichiers
- **Modifier** : `src/modules/tickets/services/tickets.service.ts`, `src/modules/tickets/domain/ticket-permissions.ts`, `src/modules/tickets/domain/ticket-status-transitions.ts` (si nécessaire), `src/modules/tickets/listeners/ticket-notification.listener.ts`, `src/modules/sla/sla-alert-processor.service.ts`, `src/modules/sla/sla-policies.service.ts`, `src/modules/departments/departments.service.ts`, specs associés
- **Créer** : éventuellement `src/modules/tickets/services/ticket-sla.service.ts` (factorisation), spec `tickets-concurrency.fix.spec.ts`

## Todo
- [ ] assign/escalate : validation d'état + UPDATE conditionnel (P1-5)
- [ ] Transactions runInTransaction sur assign/escalate/update (P1-6)
- [ ] Tests de concurrence (double claim) verts
- [ ] FIRST_RESPONSE pause-aware + extension au resume (P2-1)
- [ ] accumulatedPauseMs cumulée sur PENDING→RESOLVED (P2-2)
- [ ] Recalcul SLA sur update category/priority (P2-3)
- [ ] Rallonge réouverture via politique/config (P2-4)
- [ ] Décision D1 appliquée + test de conformité RBAC (P2-9)
- [ ] Unicité nom département (P2-10)
- [ ] Catégorie dans l'email (P2-11)
- [ ] Code mort SLA supprimé/branché (P2-12)
- [ ] E2E cycle de vie ticket verts

## Critères de succès
- Gate D partielle : toutes les mutations ticket sont transactionnelles et validées par la machine à états.
- Les tests existants de la machine à états restent verts ; les nouveaux tests de concurrence passent.
