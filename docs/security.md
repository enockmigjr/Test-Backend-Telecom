# Guide de Sécurité

## Vue d'ensemble

Ce document décrit les mesures de sécurité implémentées dans le backend.

---

## Authentification

### JWT (JSON Web Tokens)

| Token         | Durée de vie | Stockage serveur        | Rotation     |
| ------------- | ------------ | ----------------------- | ------------ |
| Access Token  | 15 minutes   | N/A (stateless)         | À chaque refresh |
| Refresh Token | 7 jours      | PostgreSQL (hash SHA-256) | À chaque refresh |

**Argon2id** pour le hachage des mots de passe :
- memory: 64 MB
- time: 3 itérations
- parallelism: 4 threads

### Rotation des Refresh Tokens

Chaque `POST /auth/refresh` :
1. Vérifie le refresh token en base (hash SHA-256)
2. Vérifie la correspondance IP + User-Agent
3. Révoque l'ancien refresh token
4. Émet un nouveau couple (access + refresh)
5. Blacklist le JTI de l'ancien access token dans Redis

### Révocation individuelle

- `POST /auth/logout` : révoque le refresh token courant
- `POST /auth/logout-all` : révoque tous les refresh tokens de l'utilisateur

### Nettoyage automatique

- Cron quotidien à 3h : supprime les refresh tokens expirés et révoqués depuis plus de 30 jours

---

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

| Route        | Limite                | Fenêtre     |
| ------------ | --------------------- | ----------- |
| Général      | 100 requêtes          | 15 minutes  |
| `POST /auth/login` | 10 tentatives   | 1 heure/IP  |
| `POST /auth/refresh` | 20 tentatives | 15 minutes  |

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

- Cache Redis pendant 24h
- Retourne la réponse mise en cache si la clé existe

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
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
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

## Secrets et variables sensibles

### En développement

Les valeurs par défaut dans `.env.example` sont suffisantes. **Ne jamais commit `.env`**.

### En production

Obligatoirement changer :

| Variable               | Exigence                       |
| ---------------------- | ------------------------------ |
| `JWT_ACCESS_SECRET`    | ≥ 32 caractères aléatoires    |
| `JWT_REFRESH_SECRET`   | ≥ 32 caractères aléatoires    |
| `DATABASE_PASSWORD`    | Mot de passe fort              |
| `REDIS_PASSWORD`       | Mot de passe fort              |
| `SMTP_USER/PASSWORD`   | Credentials SMTP réels         |
| `REPORT_DOWNLOAD_SECRET` | ≥ 32 caractères aléatoires  |
