# Phase 05 — Surfaces d'administration et secrets

## Statut

- Prévu — dépend de Phase 00 (parallélisable avec 03/04)
- Findings traités : **P1-7** (BullBoard admin/bullboard), **P1-8** (/metrics public), **P1-10** (secret HMAC rapports en dur), **P2-42** (fallback mot de passe DB), **P3-aj** (routage BullBoard forRoutes vs basePath), **P3-g** (Cache-Control download interne)

## Contexte

Trois surfaces d'administration reposent sur des secrets par défaut ou l'absence d'auth : BullBoard (`admin:bullboard` en prod si les variables manquent, comparaison non timing-safe), `/metrics` (public, non throttlé), et les liens signés de rapports (secret de développement actif dès que `NODE_ENV ≠ production`). La config DB accepte aussi un mot de passe par défaut en production.

## Vue d'ensemble

1. **P1-7** : `BullBoardModule` — exiger `BULLBOARD_USER`/`BULLBOARD_PASSWORD` au démarrage en production (throw, comme `JwtConfigService.getSecret`) ; comparer les credentials avec `crypto.timingSafeEqual` (et contrôle de longueur) ; documenter la restriction réseau Nginx dans `nginx/` si applicable.
2. **P3-aj** : aligner `forRoutes` sur le `basePath` réel (préfixe `API_PREFIX`) — tester le montage au runtime (le point était marqué « à vérifier »).
3. **P1-8** : `/metrics` — retirer `ANONYMOUS` ; ajouter un garde dédié « scraping » (token Bearer via `METRICS_SCRAPE_TOKEN`, comparé en timing-safe, ou IP allowlist Nginx) ; conserver `@SkipThrottle` ; documenter dans le contrôleur.
4. **P1-10** : `ReportDownloadLinkService` — lever une erreur fatale au démarrage si `REPORT_DOWNLOAD_SECRET` absent **quel que soit l'environnement** (ou au moins hors dev explicite) ; supprimer le fallback en dur ; borner le TTL par défaut (24-48 h au lieu de 7 jours) si la décision métier le permet (vérifier usage).
5. **P2-42** : `DatabaseConfig` — étendre la garde de production au mot de passe DB (throw en prod si absent) ; ne jamais logguer l'URL complète (getter `url` inclut le password — vérifier les usages).
6. **P3-g** : ajouter `Cache-Control: private, no-store` au download interne des pièces jointes (`attachments.controller.ts:streamFile`).

## Exigences

- Ne pas casser le scraping Prometheus existant (le `METRICS_SCRAPE_TOKEN` doit être documenté dans le docker-compose/prometheus.yml — coordination infra).
- Le lien signé de rapport : vérifier la durée utilisée par les emails existants avant de réduire le TTL.

## Étapes

1. Tests rouges : BullBoard sans credentials en prod → boot refusé ; `/metrics` sans token → 401 ; secret rapport absent → boot refusé.
2. Correctifs BullBoard (gating + timing-safe + routage vérifié).
3. Garde metrics scraping + mise à jour `prometheus.yml`/docs si présent dans le repo.
4. Gating secret rapports + TTL documenté.
5. Gating mot de passe DB.
6. Cache-Control download interne.
7. Tests unitaires + vérification manuelle du montage BullBoard (démarrage local).

## Fichiers

- **Modifier** : `src/common/bull-board/bull-board.module.ts`, `src/common/metrics/metrics.controller.ts` (+ éventuellement `metrics.module.ts`), `src/modules/reports/report-download-link.service.ts`, `src/config/database.config.ts`, `src/modules/attachments/attachments.controller.ts`, specs
- **Créer** : garde `src/common/metrics/metrics-scrape.guard.ts` (+ spec), éventuellement note dans `prometheus/prometheus.yml`

## Todo

- [ ] Gating BullBoard prod + timingSafeEqual (P1-7)
- [ ] Routage BullBoard vérifié et corrigé (P3-aj)
- [ ] Garde scraping `/metrics` (P1-8)
- [ ] Gating REPORT_DOWNLOAD_SECRET + TTL (P1-10)
- [ ] Gating DATABASE_PASSWORD (P2-42)
- [ ] Cache-Control download interne (P3-g)
- [ ] Tests unitaires + boot test

## Critères de succès

- Gate E : démarrage impossible en production sans les secrets BullBoard/rapports/DB.
- Le scraping Prometheus continue de fonctionner avec le token configuré (test E2E ou vérification docker-compose).
