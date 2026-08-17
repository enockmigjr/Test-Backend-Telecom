# Rapport de Revue de Code Backend (Senior Code Review)

**Date** : 14 août 2026  
**Périmètre** : Ensemble du backend NestJS (`src/`)  
**Agent référent** : `code-reviewer`  
**Workflow appliqué** : `/review` (`.agents/workflows/review.md`)  
**Statut** : Inspection en lecture seule complète — Aucun fichier source modifié.

---

## 1. Vue d'ensemble et Synthèse

Le backend NestJS de l'application ITSM Télécom présente une architecture globale solide (Monolithe Modulaire, typage strict TypeScript, isolation ABAC/RBAC, Outbox Pattern, observabilité Pino/OTEL/Prometheus, et intégration Keycloak SSO).

Cependant, une analyse approfondie en tant que Senior Software Architect révèle plusieurs failles de sécurité, incohérences de logique métier, goulots d'étranglement de performance et non-respects des normes de maintenabilité du dépôt.

### Répartition des Constats par Sévérité

- **CRITICAL (Critique)** : 3
- **HIGH (Élevé)** : 4
- **MEDIUM (Moyen)** : 6
- **LOW (Faible)** : 5

---

## 2. Constats Détaillés (Findings)

### [CRITICAL] [src/modules/auth/strategies/jwt.strategy.ts:85-88] — Contournement de la révocation des jetons JWT pour Keycloak SSO

- **Problème** : Dans la méthode `validate(payload: JwtPayload)`, si le jeton est identifié comme un jeton Keycloak (`if (this.isKeycloakToken(payload))`), la méthode retourne directement `this.validateKeycloak(payload)` sans exécuter la vérification `isRevoked(payload)`.
- **Risque** : En cas de déconnexion globale (`logoutAll`) ou de mise sur liste noire d'un jeton dans Redis (`jwt_bl:{jti}` / `jwt_user_bl:{sub}`), les jetons émis par Keycloak restent acceptés par l'API jusqu'à leur expiration naturelle. Un compte compromis ou désactivé côté session conserve son accès HTTP.
- **Correction recommandée** : Déplacer ou appliquer le contrôle `await this.isRevoked(payload)` pour **tous** les types de jetons (Keycloak ou locaux) au début de `validate()`.

```typescript
// Correctif recommandé dans jwt.strategy.ts
async validate(payload: JwtPayload) {
  if (await this.isRevoked(payload)) {
    throw new UnauthorizedException('Token révoqué.');
  }
  if (this.isKeycloakToken(payload)) {
    return this.validateKeycloak(payload);
  }
  // ...
}
```

---

### [CRITICAL] [src/modules/auth/strategies/jwt.strategy.ts:180-184] — Liaisons implicites de profils sur email non vérifié (`bindProfileByEmail`)

- **Problème** : Dans `bindProfileByEmail`, l'expression `const emailVerified = payload['email_verified'] !== false;` évalue à `true` si le claim `email_verified` est indéfini (`undefined !== false` vaut `true`).
- **Risque** : Si un fournisseur SSO tiers ou une configuration Keycloak n'envoie pas le claim `email_verified`, le système associe et lie silencieusement l'identité SSO au profil utilisateur local (`keycloakSubjectId = subject`) sur la seule base de la chaîne email. Un attaquant contrôlant un email non vérifié sur un IdP externe peut usurper un compte agent/admin local.
- **Correction recommandée** : Exiger explicitement `payload['email_verified'] === true` pour lier un compte local.

```typescript
// Correctif recommandé
const emailVerified = payload['email_verified'] === true;
if (!email || !emailVerified) return undefined;
```

---

### [CRITICAL] [src/modules/support-bot/services/support-bot.service.ts:107-116] — Boucle d'exécution des outils de l'Assistant IA incomplète (Tool Loop Incomplète)

- **Problème** : Lorsque l'assistant IA (`SupportBotService.reply`) retourne des `toolCalls` (ex. `knowledge_search`, `save_draft`, `request_human`), le service exécute les outils via `this.tools.execute()` et enregistre les résultats dans `toolTrace`, mais ne réinjecte **jamais** les résultats de l'outil dans le fournisseur IA (`provider.complete`) pour une seconde passe de synthèse.
- **Risque** : La réponse finale renvoyée à l'utilisateur est le contenu initial `result.content` (généré _avant_ l'exécution des outils). Par exemple, après une recherche documentaire (`knowledge_search`), le bot n'utilise pas les articles trouvés pour répondre à l'utilisateur. La fonction de bot conversationnel est partiellement dysfonctionnelle.
- **Correction recommandée** : Implémenter une vraie boucle récursive/itérative multi-tours (jusqu'à `MAX_TOOL_ROUNDS`) réinjectant la fonction/outil exécuté et son résultat (`role: 'tool'`) dans l'historique des messages transmis au modèle IA.

---

### [HIGH] [src/common/interceptors/idempotency.interceptor.ts:89] — Suppressions SQL systématiques en ligne sur chaque requête (Contention DB)

- **Problème** : Sur chaque requête HTTP contenant l'en-tête `Idempotency-Key`, l'intercepteur exécute la requête `DELETE FROM idempotency_records WHERE expires_at <= NOW()`.
- **Risque** : Sous forte charge d'appels idempotents simultanés, ces requêtes `DELETE` non ciblées verrouillent la table `idempotency_records`, dégradant la latence globale et créant des risques de deadlocks en base de données.
- **Correction recommandée** : Retirer le `DELETE` synchrone de l'intercepteur. Confier la purge des enregistrements expirés à une tâche de fond planifiée (`@Cron` BullMQ ou pg_cron).

---

### [HIGH] [src/modules/tickets/services/tickets.service.ts:242-264, 360-390, 420-445] — Absence de transactions atomiques sur les mutations critiques de tickets

- **Problème** : Dans `TicketsService`, les méthodes `update()`, `assign()`, et `escalate()` exécutent plusieurs opérations d'écriture séparées (ex. `drizzle.db.insert(ticketAssignments)` puis `drizzle.db.update(tickets)` et `ticketHistory.recordByActor`) hors de toute transaction SQL (`runInTransaction`).
- **Risque** : Si le serveur subit un crash ou si la seconde écriture échoue, l'état de la base de données devient incohérent (ex. une entrée d'attribution créée dans `ticket_assignments` alors que le ticket conserve son ancien assigné).
- **Correction recommandée** : Envelopper systématiquement les opérations multi-tables dans `this.drizzle.runInTransaction(...)`.

---

### [CRITICAL] [src/modules/support-bot/services/tool-policy.service.ts:59] — Paramètre de statut de conversation codé en dur (`'OPEN'`)

- **Problème** : Dans `ToolPolicyService.execute`, l'autorisation d'exécution d'outil fait appel à `if (!this.authorize(call.name, 'OPEN'))` avec la chaîne littérale `'OPEN'` en dur au lieu d'utiliser le statut réel de la conversation `conversation.status`.
- **Risque** : Si une conversation est fermée ou archivée, la vérification d'autorisation passe quand même la condition de statut, permettant l'exécution d'actions (ex. enregistrement de brouillon) sur une conversation non ouverte.
- **Correction recommandée** : Passer le vrai statut `conversation.status` à `authorize()`.

---

### [HIGH] [src/modules/tickets/listeners/ticket-notification.listener.ts:53-80, 110-140] — Requêtes N+1 et absence d'agrégation sur la diffusion des notifications

- **Problème** : Lors d'événements de création ou d'assignation de tickets, `TicketNotificationListener` exécute individuellement `getUserInfo()`, `getUserEmail()`, et `getTicketEmailContext()` pour chaque destinataire de notification.
- **Risque** : Pour un ticket impactant un grand département ou une équipe, des dizaines de requêtes SQL unitaires identiques sont lancées vers PostgreSQL, augmentant le temps de traitement de l'événement.
- **Correction recommandée** : Pré-charger le contexte du ticket et récupérer les emails des destinataires en une seule requête groupée (`inArray(users.id, recipientIds)`).

---

### [MEDIUM] [Violation des normes] — 21 fichiers source dépassent le seuil strict de 200 lignes (`AGENTS.md`)

- **Problème** : La règle d'architecture du projet impose que les fichiers source restent sous la barre des 200 lignes. Actuellement, 21 fichiers dépassent cette limite :
  1. `src/database/seed/run-seed.ts` (1097 lignes)
  2. `src/modules/dashboard/dashboard.service.ts` (683 lignes)
  3. `src/modules/tickets/services/tickets.service.ts` (616 lignes)
  4. `src/modules/tickets/listeners/ticket-notification.listener.ts` (489 lignes)
  5. `src/modules/external-requesters/services/external-requesters-admin.service.ts` (451 lignes)
  6. `src/modules/reports/reports.service.ts` (445 lignes)
  7. `src/modules/users/users.service.ts` (435 lignes)
  8. `src/queues/workers/report.worker.ts` (398 lignes)
  9. `src/modules/tickets/tickets.controller.ts` (393 lignes)
  10. `src/modules/tickets/services/auto-assignment.cron.ts` (294 lignes)
  11. `src/modules/sla/sla-alert-processor.service.ts` (289 lignes)
  12. `src/modules/tickets/services/assignment-engine.service.ts` (287 lignes)
  13. `src/modules/external-delivery/services/external-delivery.service.ts` (257 lignes)
  14. `src/modules/dashboard/dashboard.controller.ts` (257 lignes)
  15. `src/modules/auth/strategies/jwt.strategy.ts` (243 lignes)
  16. `src/modules/support-knowledge/services/support-knowledge.service.ts` (240 lignes)
  17. `src/modules/support-bot/services/support-bot.service.ts` (240 lignes)
  18. `src/modules/tickets/domain/ticket-permissions.ts` (239 lignes)
  19. `src/modules/reports/reports.controller.ts` (237 lignes)
  20. `src/modules/users/users.controller.ts` (213 lignes)
  21. `src/modules/comments/comments.service.ts` (208 lignes)

- **Risque** : Perte de lisibilité, couplage fort, et complexité d'audit et de maintenance.
- **Correction recommandée** : Découper les gros services en sous-services par domaine (ex. découper `tickets.service.ts` en `ticket-creation.service.ts`, `ticket-lifecycle.service.ts`, `ticket-assignment.service.ts`).

---

### [MEDIUM] [src/common/helpers/pagination.helper.ts vs normalized-pagination.helper.ts] — Redondance de helpers de pagination

- **Problème** : Deux helpers distincts existent pour traiter la pagination : `pagination.helper.ts` et `normalized-pagination.helper.ts`.
- **Risque** : Risque de divergences sur les valeurs par défaut (limit max, offset min) et duplication d'effort.
- **Correction recommandée** : Fusionner ces helpers en un seul composant canonique `pagination.helper.ts`.

---

### [MEDIUM] [src/modules/dashboard/dashboard.service.ts:80-130] — Exécution répétée d'agrégations non cachées sur les requêtes Overview

- **Problème** : `DashboardService.overview` exécute simultanément 7 à 9 requêtes SQL complexes (`COUNT(*)`, jointures, filtres de dates) à chaque appel de l'API sans exploiter le cache Redis de manière systématique sur les plages historiques.
- **Risque** : Charge inutile sur PostgreSQL lors du rafraîchissement fréquent des tableaux de bord par les superviseurs et administrateurs.
- **Correction recommandée** : Mettre en place un pattern Cache-Aside Redis avec une clé `dashboard:overview:{dept}:{fromDate}:{toDate}` et une TTL de 60 secondes.

---

### [LOW] [src/modules/tickets/services/tickets.service.ts:35-42] — Duplication de logique de type d'événement de statut public

- **Problème** : La fonction `publicStatusEventType` est définie localement dans `tickets.service.ts`, alors que des cartographies équivalentes existent dans le module `public-support`.
- **Correction recommandée** : Centraliser le mapping de statut public dans `src/modules/tickets/domain/public-ticket-status.ts`.

---

### [LOW] [Gestion des exceptions] — Messages d'erreur de validation parfois techniques

- **Problème** : En cas d'erreur inattendue non gérée dans `GlobalExceptionFilter`, le message par défaut reste générique mais certains détails bruts de requêtes ou de validation peuvent remonter si un sous-système jette un objet non formaté.
- **Correction recommandée** : Assainir strictement la propriété `details` pour garantir l'absence totale de traces d'empilement (stack traces) ou de noms de tables SQL en environnement de production.

---

## 3. Plan d'Action et Recommandations Priorisées

1. **Phase 1 : Correctifs de Sécurité Immédiats (P0)**
   - Appliquer la vérification `isRevoked` sur tous les jetons dans `JwtStrategy`.
   - Exiger `email_verified === true` dans `bindProfileByEmail`.
   - Corriger la valeur transmise à `ToolPolicyService.authorize` (`conversation.status`).

2. **Phase 2 : Correctifs Métier et Résilience (P1)**
   - Implémenter la boucle de synthèse multi-tours des outils de l'Assistant IA dans `SupportBotService`.
   - Englober les mutations `update`, `assign`, et `escalate` de `TicketsService` dans des transactions SQL atomiques.
   - Retirer le `DELETE` synchrone de `IdempotencyInterceptor` et créer une tâche planifiée BullMQ.

3. **Phase 3 : Refactorisation et Maintenabilité (P2)**
   - Découper les 21 fichiers de plus de 200 lignes pour respecter la norme du dépôt (`AGENTS.md`).
   - Optimiser les requêtes de notification et ajouter le caching Redis sur le Dashboard.
   - Consolider les helpers de pagination redondants.

---

## 4. Verdict de la Revue de Code

**Verdict** : **REWORK REQUIRED (Modifications requises avant mise en production)**

Le code possède une excellente base architecturale et une bonne couverture de tests, mais les correctifs P0 (sécurité des jetons et liaison SSO, logique de l'assistant IA) et P1 (transactions SQL, performance de l'idempotence) doivent être appliqués prioritairement.
