# Phase 07 — Dashboard, cache et performance données

## Statut

- Prévu — dépend de Phase 00 (parallélisable avec 06)
- Findings traités : **P2-5** (cache dashboard absent malgré AGENTS.md), **P2-6** (KPI incohérents), **P2-7** (FieldProjection vide le dashboard), **P2-37** (purge idempotency par requête), **P2-38** (vue matérialisée dans le seed — décision D3), **P2-43** (ILIKE sans trigram), **P2-44** (OTel sampler), **P2-40** (clients Redis Pub/Sub sans gestion d'erreur), **P3-m** (doubles contraintes uniques), **P3-n** (index redondants), **P3-v** (compliance rate 100 % sans compteur), **P3-y** (branche morte auto-assignation), **P3-x** (nextval || 1)

## Contexte

AGENTS.md annonce un cache-aside Redis 60 s pour le dashboard ; le code n'en a aucun. Les KPI mélangent des périmètres incompatibles (numérateur ouvert / dénominateur total, âge moyen incluant les clos). La purge `idempotency_records` s'exécute à chaque requête idempotente. La vue matérialisée de workload est créée par le seed (stale après re-seed). La recherche tickets fait du ILIKE non indexé. L'adapter WebSocket crash si Redis tombe (événement `error` non géré).

## Vue d'ensemble

1. **P2-5** : implémenter le cache-aside Redis annoncé (clés `dashboard:{paramsHash}` + TTL 60 s, invalidation par événement de mutation ticket ou TTL court) — ou, si la décision métier est de ne pas cacher, corriger AGENTS.md. Décision à acter (préférer implémenter : documenté et attendu).
2. **P2-6** : aligner les périmètres des KPI (`compliant` sur le même périmètre que `total` ou documenter ; `avgAgeMinutes` borné aux tickets ouverts ; `atRisk` = échéance entre NOW et NOW+30min sans les overdue) ; supprimer la requête morte (L98).
3. **P2-7** : ne projeter que si `SUMMARY_FIELDS[resource]` existe (sinon retourner `data` tel quel).
4. **P2-37** : retirer le DELETE de l'intercepteur ; cron de purge horaire (`DELETE WHERE expires_at < now() - interval '1 day'`).
5. **P2-38 (décision D3)** : déplacer la création de la vue matérialisée (et son index unique) dans une migration ; `REFRESH MATERIALIZED VIEW CONCURRENTLY` à la fin du seed.
6. **P2-43** : migration `CREATE EXTENSION pg_trgm` + index GIN trigram sur `tickets.title`, `customer_name`, `ticket_number` (et colonnes support-knowledge).
7. **P2-44** : sampler OTel configurable (`OTEL_TRACES_SAMPLER_RATIO`, défaut 0.1 en prod, 1 en dev), headers d'auth Tempo optionnels.
8. **P2-40** : listeners `error` + retryStrategy plafonnée + `onModuleDestroy` sur les clients Pub/Sub de l'adapter WS.
9. **P3-m** : supprimer les `.unique()` dupliqués avec `uniqueIndex` (users.email, tickets.ticket_number) via migration de consolidation (DROP CONSTRAINT conservant l'index).
10. **P3-n** : supprimer les index redondants (`idxNotificationsUser`, `idx_knowledge_versions_article`) ; ajouter `(userId, isRead, createdAt DESC)` pour l'inbox.
11. **P3-v/x/y** : compliance rate null/0 quand dénominateur nul ; `??` au lieu de `||` ; branche morte et hoisting de `getMaxConcurrentTickets`.

## Exigences

- Migrations additives uniquement (création d'index, extension, vues) ; la consolidation des contraintes uniques doit être vérifiée avec `db:phase9-check`.
- Le cache dashboard ne doit pas servir de données périmées au-delà de 60 s (invalidation ou TTL).

## Étapes

1. Tests rouges : purge idempotency absente du chemin chaud (test d'intercepteur) ; KPI calculés correctement sur jeu de données connu.
2. Cache-aside dashboard (service `DashboardCacheService` + intégration dans les 7 endpoints).
3. Corrections KPI + requête morte + projection.
4. Cron de purge idempotency + tests.
5. Migration vue matérialisée + refresh seed.
6. Migrations index trigram + consolidation index ; tests de performance (EXPLAIN) documentés dans le rapport.
7. OTel sampler + adapter WS robuste.
8. Tests unitaires dashboard + intégration.

## Fichiers

- **Modifier** : `src/modules/dashboard/dashboard.service.ts`, `dashboard-sla.service.ts`, `dashboard.controller.ts`, `public-support-stats.service.ts`, `src/common/interceptors/idempotency.interceptor.ts`, `src/common/interceptors/field-projection.interceptor.ts`, `src/common/observability/otel.ts`, `src/websocket/redis-io.adapter.ts`, `src/database/seed/run-seed.ts`, `src/modules/tickets/services/auto-assignment.cron.ts`, `assignment-engine.service.ts`, `tickets-search.service.ts`, specs
- **Créer** : `src/modules/dashboard/dashboard-cache.service.ts` (+ spec), cron purge `src/common/services/idempotency-cleanup.cron.ts` (+ spec), migrations `00xx_pg_trgm_indexes.sql`, `00xx_materialized_view.sql`, `00xx_consolidate_unique_indexes.sql`

## Todo

- [ ] Cache-aside dashboard implémenté ou AGENTS.md corrigé (P2-5)
- [ ] KPI alignés + requête morte supprimée (P2-6)
- [ ] Projection dashboard corrigée (P2-7)
- [ ] Purge idempotency déplacée en cron (P2-37)
- [ ] Vue matérialisée migrée + refresh seed (P2-38)
- [ ] Index trigram (P2-43)
- [ ] Sampler OTel (P2-44)
- [ ] Adapter WS robuste (P2-40)
- [ ] Consolidation contraintes/index (P3-m/n)
- [ ] P3-v/x/y

## Critères de succès

- Dashboard : réponse servie depuis le cache (test d'intégration avec Redis mock) et invalidée dans la fenêtre.
- `EXPLAIN` avant/après documenté pour la recherche tickets (index trigram utilisé).
- Aucune régression des 7 endpoints (tests dashboard verts).
