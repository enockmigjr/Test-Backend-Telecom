# Guide de Sécurité

## Vue d'ensemble

Ce document décrit les mesures de sécurité implémentées dans le backend.

---

## Authentification

### JWT (JSON Web Tokens)

### Keycloak SSO (unique depuis le 13/08/2026)

Keycloak est l'**unique fournisseur d'authentification** (OIDC avec PKCE côté BFF).
Les anciennes routes locales (`/auth/login`, `/auth/refresh`, `/auth/logout`,
`/auth/logout-all`, `/auth/change-password`) ont été supprimées.

| Jeton         | Durée (realm telecom) | Validation                                                |
| ------------- | --------------------- | --------------------------------------------------------- |
| Access Token  | 15 min                | Signature RS256 via JWKS Keycloak                         |
| Refresh Token | 7 j (session SSO)     | Keycloak (grant `refresh_token`)                          |
| ID Token      | 5 min                 | Conservé (HttpOnly) pour le logout OIDC (`id_token_hint`) |

- **Logout** : endpoint OIDC `end-session` → retour sur `/login`, plus de session
  SSO résiduelle (l'`id_token` est conservé pendant toute la session).
- **Logout de toutes les sessions** : révoque les sessions de l'utilisateur via
  l'API admin Keycloak (`POST /admin/realms/{realm}/users/{id}/logout`).
- **Mot de passe** : géré dans la console de compte Keycloak
  (`http://localhost:8081/realms/telecom/account/`), pas dans l'application.
- Le profil métier (rôle, département, disponibilité) est lié au sujet Keycloak
  (`users.keycloakSubjectId`) et sert le RBAC/ABAC applicatif.

---

### Modes d'authentification

Le guard global `RequestAuthGuard` aiguille chaque route vers un mode explicite (`@Auth(...)`) :

| Mode                    | Mécanisme                                                                                | Routes                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `INTERNAL`              | Jeton Keycloak Bearer (RS256/JWKS), profil métier lié par `keycloakSubjectId`            | ticketing interne, users, dashboard, reports…                       |
| `PUBLIC_SESSION`        | JWT de session publique (issuer/audience distincts, appareil de confiance actif)         | portail public, widget, bot, knowledge                              |
| `INTEGRATION_ASSERTION` | Assertion signée serveur→serveur (WordPress), usage unique (nonce Redis), origine exacte | échange d'assertion                                                 |
| `ANONYMOUS`             | Aucun                                                                                    | login, health, metrics, config publique, soumission de satisfaction |

## Autorisation (RBAC + ABAC)

### 7 rôles hiérarchiques

```
ADMINISTRATOR          → Accès complet, gestion globale
SUPERVISOR             → Gestion département, assignation
CUSTOMER_SERVICE_AGENT → Tickets customer care
NOC_ENGINEER           → Tickets réseau (NOC)
BILLING_AGENT          → Tickets facturation
TECHNICAL_SUPPORT_ENGINEER → Tickets support technique
FIELD_TECHNICIAN       → Tickets terrain (pas de notes internes)
```

### Guards NestJS

```
Request → JwtAuthGuard → RolesGuard → DepartmentGuard → Controller
```

1. **JwtAuthGuard** : valide le JWT, extrait `sub`, `email`, `role`, `departmentId`
2. **RolesGuard** : vérifie `@Roles(Role.ADMINISTRATOR, Role.SUPERVISOR)`
3. **DepartmentGuard** (implicite) : cloisonnement ABAC dans les services

### Cloisonnement départemental (ABAC)

- Les agents et superviseurs ne voient que les tickets de leur département
- Les administrateurs ont une vue globale
- Vérifié dans les services (pas dans les guards) pour plus de flexibilité

---

## Rate Limiting

Distribué via Redis (ThrottlerStorageRedisService) :

| Route                                                     | Limite        | Fenêtre    |
| --------------------------------------------------------- | ------------- | ---------- |
| Général (défaut)                                          | 1000 requêtes | 15 minutes |
| Routes sensibles (défaut, ex. login SSO, OTP, assertions) | 20 tentatives | 1 heure/IP |

Les valeurs sont configurables via `THROTTLE_TTL` / `THROTTLE_LIMIT` / `THROTTLE_AUTH_TTL` / `THROTTLE_AUTH_LIMIT`. Le stockage Redis est distribué avec repli mémoire en cas de panne Redis.

### Réinitialiser (dev uniquement)

```bash
docker compose exec redis redis-cli FLUSHALL
```

---

## Idempotence

Le décorateur `@Idempotent()` + header `Idempotency-Key` garantit qu'une requête POST/PATCH ne sera exécutée qu'une seule fois, même si rejouée :

```bash
curl -X POST /api/v1/tickets \
  -H "Idempotency-Key: unique-uuid-v4" \
  -H "Authorization: Bearer <token>" \
  -d '{ ... }'
```

- Table `idempotency_records` (PostgreSQL) avec TTL 24h, fingerprint du body
- Retourne la réponse mise en cache si la clé existe
- `@RequireIdempotency()` impose la clé sur les mutations publiques (portail, widget, bot)

---

## Headers de sécurité (Helmet)

Helmet applique automatiquement les headers :

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security` (en production)
- `Content-Security-Policy`
- `X-XSS-Protection`

---

## CORS

Configuré via `CORS_ORIGIN` (liste de domaines séparés par des virgules) :

```env
CORS_ORIGIN=http://localhost:3000,http://localhost:3007
```

---

## Validation des entrées

Toutes les entrées sont validées via **class-validator** + **class-transformer** :

```typescript
@Post()
async create(@Body() dto: CreateTicketDto) { ... }
```

Le `ValidationPipe` global rejette automatiquement les requêtes invalides avec un code 400 et les détails des erreurs.

---

## Protection contre les injections

- **SQL Injection** : Drizzle ORM avec requêtes paramétrées (jamais de SQL brut)
- **XSS** : Helmet headers + validation des entrées
- **CSRF** : JWT Bearer tokens (pas de cookies pour l'API directe)
- **Path Traversal** : Validation des noms de fichiers dans le module attachments
- **Command Injection** : Pas d'exécution de commandes shell

---

## Audit Trail

Toutes les actions critiques sont enregistrées dans la table `audit_logs` (immutable, write-only) :

- Login / Logout
- Création / Modification / Suppression d'utilisateurs
- Changements de statut de tickets
- Assignation / Réassignation
- Modifications de paramètres système
- Modifications SLA

Chaque entrée contient : userId, action, entityType, entityId, oldValue, newValue, ipAddress, userAgent.

---

## Support public (identité externe)

- **OTP email** : code 6 chiffres haché (HMAC), destination chiffrée AES-256-GCM, quotas par IP/contact/intégration, réponses uniformes anti-énumération.
- **Appareils de confiance** : jetons opaques hachés, validité 90 jours renouvelable, politique versionnée (révocation/raccourcissement administrés).
- **Assertions WordPress** : JWT signé avec les secrets d'intégration versionnés, audience dédiée, durée bornée (≤ 120 s), nonce anti-rejeu Redis, origine exacte.
- **Pièces jointes publiques** : quarantaine obligatoire, inspection du type réel (`file-type`), scan ClamAV, promotion `clean/` uniquement si `CLEAN`, quotas par demandeur/IP/intégration.
- **Secrets d'intégration** : chiffrés AES-256-GCM avec clés maîtresses versionnées, rotation avec grâce, jamais renvoyés par l'API ni journalisés.
- **Rétention** : anonymisation automatique des demandeurs inactifs, purge des challenges OTP et idempotences, fusion de profils auditée.

## Secrets et variables sensibles

### En développement

Les valeurs par défaut dans `.env.example` sont suffisantes. **Ne jamais commit `.env`**.

### En production

Obligatoirement changer :

| Variable                  | Exigence                                            |
| ------------------------- | --------------------------------------------------- |
| `KEYCLOAK_ADMIN_PASSWORD` | Mot de passe admin Keycloak fort                    |
| `KEYCLOAK_HOSTNAME`       | Domaine public de Keycloak (ex. `auth.example.com`) |
| `AUTH_CSRF_SECRET`        | ≥ 32 caractères aléatoires                          |
| `DATABASE_PASSWORD`       | Mot de passe fort                                   |
| `REDIS_PASSWORD`          | Mot de passe fort                                   |
| `SMTP_USER/PASSWORD`      | Credentials SMTP réels                              |
| `REPORT_DOWNLOAD_SECRET`  | ≥ 32 caractères aléatoires                          |
