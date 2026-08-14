# Plan — Corrections issues de la revue de code backend (P1/P2 prioritaires)

## Statut
- État : audit complet réalisé (14/08/2026) — 2 rapports fusionnés : `plans/reports/review-260814-1314-backend-full-audit.md` (audit principal, 12 P1 vérifiés manuellement) et `plans/reports/review-260814-1600-backend-code-review.md` (second agent, recoupé finding par finding).
- Design source : AGENTS.md
- Mode : **normal** — correctifs ciblés sans refonte ; chaque phase a ses tests et sa preuve de clôture
- Dépôts : backend uniquement (`src/`)

## Objectif
Corriger les 12 P1 et les P2 prioritaires identifiés par la revue : sécurité des jetons et des surfaces d'administration, atomicité des mutations tickets, fiabilité des files BullMQ/outbox, cohérence SLA, cloisonnement RBAC, et dette critique — **sans changer le contrat OpenAPI existant**.

## Décisions d'exécution
1. Aucune modification d'API publique (routes, DTO, contrats OpenAPI) sauf validation sémantique interne (DTO de recherche, settings) — régénérer l'OpenAPI après chaque phase (`pnpm run openapi:check`).
2. Chaque correctif doit être accompagné d'un test unitaire qui échoue avant / passe après.
3. Les migrations sont additives uniquement (index, contraintes partielles) — jamais de rollback destructif.
4. Les secrets (BullBoard, REPORT_DOWNLOAD_SECRET, DATABASE_PASSWORD) passent en **fail-closed** : erreur au démarrage si absents en production.
5. Toute modification de la matrice RBAC réelle (close/reopen) doit être actée avec le métier avant implémentation (P2-9).

## Séquence
1. [Phase 00 — Baseline et garde-fous](./phase-00-baseline-gardes-fous.md)
2. [Phase 01 — Sécurité des jetons et authentification](./phase-01-securite-jetons-auth.md)
3. [Phase 02 — RBAC, utilisateurs et provisionnement Keycloak](./phase-02-rbac-users-keycloak.md)
4. [Phase 03 — Tickets : atomicité, machine à états, SLA](./phase-03-tickets-atomicite-sla.md)
5. [Phase 04 — Files BullMQ, outbox et livraisons](./phase-04-files-outbox-livraisons.md)
6. [Phase 05 — Surfaces d'administration et secrets](./phase-05-surfaces-admin-secrets.md)
6. [Phase 06 — Bot, satisfaction et rétention publique](./phase-06-bot-satisfaction-retention.md)
8. [Phase 07 — Dashboard, cache et performance données](./phase-07-dashboard-cache-perf.md)
9. [Phase 08 — Dette de structure et alignement doc/code](./phase-08-dette-structure-doc.md)

## Chemin critique
`Phase 00 → 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08`
- Parallélisable : Phase 05 avec 03/04 ; Phase 07 avec 06 ; Phase 08 en continu après 02.
- Les phases 01, 02, 05 (sécurité) et 03, 04 (fiabilité) sont les plus critiques : à livrer en premier.

## Gates absolues
- **Gate A (chaque phase)** : `pnpm run build` OK + tests unitaires de la phase verts + zéro `any`/`@ts-ignore` ajouté + fichiers < 200 lignes.
- **Gate B (fin phase 01)** : la vérification de révocation s'applique aux jetons Keycloak (test de contrat) ; `email_verified` strict.
- **Gate C (fin phase 02)** : un SUPERVISOR ne peut plus modifier un ADMIN ; échec Keycloak ne bloque plus l'email (test de recréation).
- **Gate D (fin phase 04)** : les 8 queues ont `attempts`/`backoff` ; aucun état terminal sans rejeu ou alerte.
- **Gate E (fin phase 05)** : démarrage impossible en production sans secrets BullBoard/rapports/DB.
- **Gate F (fin de plan)** : `pnpm run test:all` vert (585+ tests unitaires + 24 fichiers E2E), `pnpm run lint` sans erreur nouvelle, `pnpm run openapi:check` vert.

## Décisions requises avant production
- **D1 (P2-9)** : la matrice RBAC AGENTS.md fait-elle foi (→ restreindre le code : close = SUPERVISOR/ADMIN uniquement) ou le code fait-il foi (→ mettre à jour AGENTS.md) ? À trancher avant la Phase 03.
- **D2 (P2-33)** : vérifier la règle réseau Nginx (le port NestJS ne doit pas être joignable directement) ; sinon prévoir `trust proxy` stricte.
- **D3 (P2-38)** : confirmer que la vue matérialisée peut être déplacée du seed vers une migration sans impact sur les environnements existants.
- **D4 (P1-1)** : d'où proviennent les événements de révocation (BFF ? Keycloak ?) pour câbler l'émission `auth.session.revoked`.

## Preuves de clôture
- Rapport de revue mis à jour avec statut de chaque finding (section dédiée par phase).
- Un test de non-régression par correctif (nommé `*.fix.spec.ts` ou intégré au spec existant).
- Compte-rendu `plans/reports/review-260814-1330-{phase}.md` par phase avec commandes exécutées et résultats.
- OpenAPI régénéré sans diff non intentionnel ; AGENTS.md mis à jour si un écart doc/code est acté (cache dashboard, RBAC, retries).
